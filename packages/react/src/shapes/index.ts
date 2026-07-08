import type { ShapeComponent } from '../plugins/types.js';
import {
  BoundaryEventShape,
  DataObjectShape,
  DefaultShape,
  EndEventShape,
  EventBasedGatewayShape,
  ExclusiveGatewayShape,
  GroupShape,
  InclusiveGatewayShape,
  IntermediateCatchEventShape,
  IntermediateThrowEventShape,
  LaneShape,
  ManualTaskShape,
  ParallelGatewayShape,
  PoolShape,
  ReceiveTaskShape,
  ScriptTaskShape,
  SendTaskShape,
  ServiceTaskShape,
  StartEventShape,
  SubProcessShape,
  TaskShape,
  TextAnnotationShape,
  UserTaskShape,
} from './shapes.js';

export * from './shapes.js';
export { EDGE_CORNER_RADIUS, ShapeLabel, theme, wrapLabel } from './common.js';

export const BUILT_IN_SHAPES: Record<string, ShapeComponent> = {
  startEvent: StartEventShape,
  endEvent: EndEventShape,
  intermediateCatchEvent: IntermediateCatchEventShape,
  intermediateThrowEvent: IntermediateThrowEventShape,
  boundaryEvent: BoundaryEventShape,
  task: TaskShape,
  userTask: UserTaskShape,
  serviceTask: ServiceTaskShape,
  scriptTask: ScriptTaskShape,
  sendTask: SendTaskShape,
  receiveTask: ReceiveTaskShape,
  manualTask: ManualTaskShape,
  exclusiveGateway: ExclusiveGatewayShape,
  parallelGateway: ParallelGatewayShape,
  inclusiveGateway: InclusiveGatewayShape,
  eventBasedGateway: EventBasedGatewayShape,
  subProcess: SubProcessShape,
  dataObject: DataObjectShape,
  textAnnotation: TextAnnotationShape,
  group: GroupShape,
  pool: PoolShape,
  lane: LaneShape,
};

export { DefaultShape };
