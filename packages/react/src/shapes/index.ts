import type { ShapeComponent } from '../plugins/types.js';
import {
  DataObjectShape,
  DefaultShape,
  EndEventShape,
  ExclusiveGatewayShape,
  InclusiveGatewayShape,
  ParallelGatewayShape,
  ScriptTaskShape,
  ServiceTaskShape,
  StartEventShape,
  SubProcessShape,
  TaskShape,
  TextAnnotationShape,
  UserTaskShape,
} from './shapes.js';

export * from './shapes.js';
export { ShapeLabel, theme, wrapLabel } from './common.js';

export const BUILT_IN_SHAPES: Record<string, ShapeComponent> = {
  startEvent: StartEventShape,
  endEvent: EndEventShape,
  task: TaskShape,
  userTask: UserTaskShape,
  serviceTask: ServiceTaskShape,
  scriptTask: ScriptTaskShape,
  exclusiveGateway: ExclusiveGatewayShape,
  parallelGateway: ParallelGatewayShape,
  inclusiveGateway: InclusiveGatewayShape,
  subProcess: SubProcessShape,
  dataObject: DataObjectShape,
  textAnnotation: TextAnnotationShape,
};

export { DefaultShape };
