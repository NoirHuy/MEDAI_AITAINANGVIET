import neo4j from 'neo4j-driver'
import { env } from '../../config/env.js'

const driver = neo4j.driver(
  env.neo4jUri,
  neo4j.auth.basic(env.neo4jUsername, env.neo4jPassword)
)

export function getSession() {
  return driver.session({ database: env.neo4jDatabase })
}

export async function closeDriver() {
  await driver.close()
}

// ─── TTL CACHE (10 MINUTES) ──────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

let _cachedSymptoms = null
let _symptomsCacheTime = 0

let _cachedSymptomNames = null
let _symptomNamesCacheTime = 0

let _cachedDiseaseOverview = null
let _diseaseOverviewCacheTime = 0

export async function getAllSymptoms(session) {
  const now = Date.now()
  if (_cachedSymptoms && (now - _symptomsCacheTime < CACHE_TTL_MS)) {
    return _cachedSymptoms
  }
  const res = await session.run('MATCH (s:Symptom) RETURN s.id AS id, s.name AS name, s.cui AS cui ORDER BY s.name')
  _cachedSymptoms = res.records.map(r => ({
    id: r.get('id'),
    name: r.get('name'),
    cui: r.get('cui') || null
  }))
  _symptomsCacheTime = now
  return _cachedSymptoms
}

export async function getAllSymptomNames(session) {
  const now = Date.now()
  if (_cachedSymptomNames && (now - _symptomNamesCacheTime < CACHE_TTL_MS)) {
    return _cachedSymptomNames
  }
  const symptoms = await getAllSymptoms(session)
  _cachedSymptomNames = symptoms.map(s => s.name)
  _symptomNamesCacheTime = now
  return _cachedSymptomNames
}

export async function getDiseaseOverview(session) {
  const now = Date.now()
  if (_cachedDiseaseOverview && (now - _diseaseOverviewCacheTime < CACHE_TTL_MS)) {
    return _cachedDiseaseOverview
  }
  const res = await session.run(`
    MATCH (d:Disease)-[r:HAS_SYMPTOM]->(s:Symptom)
    WITH d, collect({symptom: s.name, prob: r.probability, description: s.description}) AS symptoms
    OPTIONAL MATCH (d)-[ra:AFFECTS_AGE]->(a:AgeGroup)
    WITH d, symptoms, collect(DISTINCT {age: a.name, prob: ra.probability}) AS ages
    OPTIONAL MATCH (d)-[rg:AFFECTS_SEX]->(g:Sex)
    WITH d, symptoms, ages, collect(DISTINCT {sex: g.name, prob: rg.probability}) AS sexes
    RETURN d.name AS disease, d.description AS description, d.remarks AS remarks, symptoms, ages, sexes
    ORDER BY d.name
  `)
  _cachedDiseaseOverview = res.records.map(r => ({
    name: r.get('disease'),
    description: r.get('description') || '',
    remarks: r.get('remarks') || '',
    symptoms: r.get('symptoms').map(s => ({
      symptom: s.symptom,
      prob: s.prob,
      description: s.description || ''
    })).sort((a, b) => b.prob - a.prob).slice(0, 6),
    ages: r.get('ages').filter(a => a.age && a.prob).sort((a, b) => b.prob - a.prob).slice(0, 2),
    sexes: r.get('sexes').filter(s => s.sex && s.prob)
  }))
  _diseaseOverviewCacheTime = now
  return _cachedDiseaseOverview
}
