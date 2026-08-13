import { AnalyticsDailyPage, AnalyticsDailyPracticeArea, AnalyticsEvent, Consultation, ConsentRecord, PracticeArea, SearchQuery } from './models.js';

const dayStart = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const dayEnd = (date) => {
  const value = dayStart(date);
  value.setDate(value.getDate() + 1);
  return value;
};

const valueFrom = (value, keys) => {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) if (value[key]) return value[key];
  return null;
};

export const recordAnalyticsEvent = async (data) => {
  const occurredAt = data.occurredAt ?? new Date();
  const event = await AnalyticsEvent.create({ ...data, occurredAt });
  const metadata = data.metadata ?? {};

  if (data.event === 'site_search') {
    const query = String(metadata.query ?? metadata.search ?? '').trim();
    if (query) await SearchQuery.create({
      query,
      normalizedQuery: query.toLowerCase(),
      searchId: String(metadata.searchId ?? '').trim(),
      resultCount: Number(metadata.resultCount ?? 0),
      clickedResult: metadata.clickedResult ?? null,
      searchedAt: occurredAt,
    });
  }

  if (data.event === 'search_result_click') {
    const searchId = String(metadata.searchId ?? '').trim();
    if (searchId) await SearchQuery.findOneAndUpdate(
      { searchId },
      { $inc: { clickCount: 1 }, $set: { clickedResult: String(metadata.resultId ?? metadata.resultTitle ?? '') } },
    );
  }

  const date = dayStart(occurredAt);
  if (data.event === 'page_view' && data.page) {
    const source = data.source ?? null;
    const device = data.device ?? null;
    await AnalyticsDailyPage.findOneAndUpdate(
      { date, page: data.page },
      {
        $setOnInsert: { date, page: data.page },
        $inc: { views: 1, engagementSeconds: Number(metadata.engagementSeconds ?? 0) },
        $set: { source, device, country: data.country ?? null },
      },
      { upsert: true, new: true },
    );
    const uniqueSessions = await AnalyticsEvent.distinct('sessionId', {
      event: 'page_view',
      page: data.page,
      occurredAt: { $gte: date, $lt: dayEnd(date) },
      sessionId: { $nin: [null, ''] },
    });
    await AnalyticsDailyPage.updateOne({ date, page: data.page }, { $set: { uniqueSessions: uniqueSessions.length } });
  }

  if (data.event === 'practice_area_view') {
    const id = data.entity?.id ?? data.entity?.slug ?? metadata.practiceAreaId;
    if (id) {
      await AnalyticsDailyPracticeArea.findOneAndUpdate(
        { date, practiceAreaId: String(id) },
        { $setOnInsert: { date, practiceAreaId: String(id) }, $inc: { views: 1, engagementSeconds: Number(metadata.engagementSeconds ?? 0) } },
        { upsert: true, new: true },
      );
    }
  }
  return event;
};

export const dashboard = async (days = 30) => {
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
  const from = new Date();
  from.setDate(from.getDate() - safeDays + 1);
  from.setHours(0, 0, 0, 0);
  const [pages, practices, pageEvents, consultationRecords, consents, searches, searchClicks, recentConsultations, areas] = await Promise.all([
    AnalyticsDailyPage.find({ date: { $gte: from } }).lean(),
    AnalyticsDailyPracticeArea.find({ date: { $gte: from } }).lean(),
    AnalyticsEvent.find({ event: 'page_view', occurredAt: { $gte: from } })
      .select('occurredAt page visitorId sessionId source device country')
      .lean(),
    Consultation.find({ submittedAt: { $gte: from } }).select('enquiry.practiceAreaId submittedAt').lean(),
    ConsentRecord.find({ consentedAt: { $gte: from } }).lean(),
    SearchQuery.find({ searchedAt: { $gte: from } }).lean(),
    AnalyticsEvent.find({ event: 'search_result_click', occurredAt: { $gte: from } }).select('metadata occurredAt').lean(),
    Consultation.find().sort({ submittedAt: -1 }).limit(5).select('reference status submittedAt').lean(),
    PracticeArea.find().select('slug title').lean(),
  ]);

  const consultations = consultationRecords.length;
  const views = pages.reduce((sum, item) => sum + Number(item.views ?? 0), 0);
  const sessions = pages.reduce((sum, item) => sum + Number(item.uniqueSessions ?? 0), 0);
  const visitorKey = (item) => item.visitorId
    ? 'visitor:' + String(item.visitorId)
    : item.sessionId
      ? 'session:' + String(item.sessionId)
      : null;
  const visitorIds = new Set(pageEvents.map(visitorKey).filter(Boolean));
  const visitors = visitorIds.size || sessions;
  const pageMap = new Map();
  for (const item of pages) {
    const current = pageMap.get(item.page) ?? { page: item.page, views: 0, uniqueSessions: 0, consultations: 0 };
    current.views += Number(item.views ?? 0);
    current.uniqueSessions += Number(item.uniqueSessions ?? 0);
    current.consultations += Number(item.consultations ?? 0);
    pageMap.set(item.page, current);
  }
  const interestMap = new Map();
  for (const item of practices) {
    const current = interestMap.get(item.practiceAreaId) ?? { practiceAreaId: item.practiceAreaId, views: 0, engagementSeconds: 0, consultations: 0 };
    current.views += Number(item.views ?? 0);
    current.engagementSeconds += Number(item.engagementSeconds ?? 0);
    current.consultations += Number(item.consultations ?? 0);
    interestMap.set(item.practiceAreaId, current);
  }
  for (const item of consultationRecords) {
    const practiceAreaId = item.enquiry?.practiceAreaId;
    if (!practiceAreaId) continue;
    const key = String(practiceAreaId);
    const current = interestMap.get(key) ?? { practiceAreaId: key, views: 0, engagementSeconds: 0, consultations: 0 };
    current.consultations += 1;
    interestMap.set(key, current);
  }
  const practiceNames = new Map(areas.flatMap((item) => [[String(item.slug), item.title], [String(item._id), item.title]]));
  const sourceCounts = new Map();
  const deviceCounts = new Map();
  const geographyCounts = new Map();
  for (const item of pageEvents) {
    const identity = visitorKey(item);
    if (!identity) continue;
    const source = valueFrom(item.source, ['source', 'medium']) ?? 'direct';
    const device = valueFrom(item.device, ['type']);
    const sourceVisitors = sourceCounts.get(source) ?? new Set();
    sourceVisitors.add(identity);
    sourceCounts.set(source, sourceVisitors);
    if (device) {
      const deviceVisitors = deviceCounts.get(device) ?? new Set();
      deviceVisitors.add(identity);
      deviceCounts.set(device, deviceVisitors);
    }
    if (item.country) {
      const countryVisitors = geographyCounts.get(item.country) ?? new Set();
      countryVisitors.add(identity);
      geographyCounts.set(item.country, countryVisitors);
    }
  }
  const clicksBySearchId = new Map();
  const clicksByQuery = new Map();
  for (const item of searchClicks) {
    const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    const searchId = String(metadata.searchId ?? '').trim();
    const normalizedQuery = String(metadata.query ?? '').trim().toLowerCase();
    if (searchId) clicksBySearchId.set(searchId, (clicksBySearchId.get(searchId) ?? 0) + 1);
    else if (normalizedQuery) clicksByQuery.set(normalizedQuery, (clicksByQuery.get(normalizedQuery) ?? 0) + 1);
  }
  const searchMap = new Map();
  for (const item of searches) {
    const current = searchMap.get(item.normalizedQuery) ?? { query: item.query, searches: 0, resultTotal: 0, clicks: 0, noResults: 0 };
    current.searches += 1;
    current.resultTotal += Number(item.resultCount ?? 0);
    current.clicks += item.searchId
      ? (clicksBySearchId.get(String(item.searchId)) ?? Number(item.clickCount ?? 0))
      : Number(item.clickCount ?? 0);
    if (Number(item.resultCount ?? 0) === 0) current.noResults += 1;
    searchMap.set(item.normalizedQuery, current);
  }
  for (const [query, clicks] of clicksByQuery) {
    const current = searchMap.get(query);
    if (current) current.clicks += clicks;
  }
  const interest = [...interestMap.values()].sort((a, b) => b.views - a.views);
  return {
    period: { from: from.toISOString(), to: new Date().toISOString(), days: safeDays },
    metrics: {
      websiteVisitors: visitors,
      pageViews: views,
      consultationRequests: consultations,
      conversionRate: visitors ? Number(((consultations / visitors) * 100).toFixed(2)) : 0,
      averageEngagementSeconds: views ? Math.round(pages.reduce((sum, item) => sum + Number(item.engagementSeconds ?? 0), 0) / views) : 0,
    },
    traffic: (() => {
      const daily = new Map();
      const ensureDay = (date) => {
        const current = daily.get(date) ?? { date, visitorIds: new Set(), pageViews: 0, consultations: 0 };
        daily.set(date, current);
        return current;
      };
      for (const item of pageEvents) {
        const date = new Date(item.occurredAt).toISOString().slice(0, 10);
        const current = ensureDay(date);
        const identity = visitorKey(item);
        if (identity) current.visitorIds.add(identity);
        current.pageViews += 1;
      }
      for (const item of consultationRecords) {
        const date = new Date(item.submittedAt).toISOString().slice(0, 10);
        ensureDay(date).consultations += 1;
      }
      return [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map((item) => ({
        date: item.date,
        visitors: item.visitorIds.size,
        pageViews: item.pageViews,
        consultations: item.consultations,
      }));
    })(),
    mostVisitedPages: [...pageMap.values()].sort((a, b) => b.views - a.views),
    visitorInterest: interest.map((item) => ({
      ...item,
      practiceAreaTitle: practiceNames.get(String(item.practiceAreaId)) ?? item.practiceAreaId,
    })),
    trafficSources: [...sourceCounts.entries()].map(([source, ids]) => ({ source, visitors: ids.size })),
    devices: [...deviceCounts.entries()].map(([device, ids]) => ({ device, visitors: ids.size })),
    geography: [...geographyCounts.entries()].map(([country, ids]) => ({ country, visitors: ids.size })),
    consent: {
      total: consents.length,
      analyticsAccepted: consents.filter((item) => item.analytics).length,
      essentialOnly: consents.filter((item) => !item.analytics).length,
      acceptanceRate: consents.length ? Number(((consents.filter((item) => item.analytics).length / consents.length) * 100).toFixed(2)) : 0,
    },
    search: [...searchMap.values()].sort((a, b) => b.searches - a.searches).slice(0, 50).map((item) => ({ query: item.query, searches: item.searches, clicks: item.clicks, noResults: item.noResults, averageResults: item.searches ? Number((item.resultTotal / item.searches).toFixed(1)) : 0 })),
    opportunities: interest.slice(0, 3).map((item) => ({
      type: 'interest',
      title: (practiceNames.get(String(item.practiceAreaId)) ?? 'Practice area') + ' is receiving attention',
      description: item.views + ' views and ' + item.consultations + ' consultation requests in this period.',
      evidence: item,
    })),
    recentConsultations,
  };
};
