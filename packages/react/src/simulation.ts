/**
 * `@buildtovalue/react/simulation` — opt-in subpath for the simulation UI.
 * Editor-only consumers that import from `@buildtovalue/react` should not
 * have to rely on tree-shaking to drop this surface (melhorias F6); import it
 * from here instead. The root barrel keeps re-exporting for compatibility.
 */
export * from './simulation/BpmnSimulator.js';
export * from './simulation/SimulationPanel.js';
export * from './simulation/SimulationOverlaySvg.js';
export * from './simulation/GatewayChoiceCard.js';
export * from './simulation/useSimulation.js';
export * from './simulation/edgePath.js';
