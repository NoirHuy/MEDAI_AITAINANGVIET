/**
 * Barrel Export for Backward Compatibility.
 * Re-exports GraphRAG services from modularized implementations.
 */
export { computeAdaptiveContext } from './graphrag/adaptiveContext.js'
export { formatAdaptiveContext } from './graphrag/formatContext.js'
export { extractSymptomsFromHistory, matchSymptomsToGraph } from './graphrag/symptomExtraction.js'
export { closeDriver, getAllSymptoms, getAllSymptomNames, getDiseaseOverview } from './graphrag/neo4jClient.js'
export { searchUMLS } from './graphrag/umlsClient.js'
export { computeDiseaseScore, computeTemporalMultiplier, getPrevalenceBoost } from './graphrag/scoring.js'
