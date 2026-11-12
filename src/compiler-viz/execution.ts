import type { Store } from '@/lib/store';

export type StackValueType =
    | 'num' | 'bool' | 'nil' | 'str'
    | 'fn' | 'native' | 'class' | 'inst' | 'method' | 'upval';

export interface StackValue {
    t: StackValueType;
    v?: number | boolean | string;
    name?: string;
    class?: string;
    arity?: number;
}

export interface CallFrameInfo {
    fn: string;
    base: number;
}

export interface VmStep {
    msg_type: 'vm_step';
    chunk: string;
    offset: number;
    stack: StackValue[];
    frames: CallFrameInfo[];
}

export interface TaggedPrint {
    text: string;
    stepIndex: number;
    srcOffset?: number;
    chunk?: string;
    offset?: number;
}

export interface ExecutionState {
    steps: VmStep[];
    prints: TaggedPrint[];
    currentStep: number | null;
    playing: boolean;
    active: boolean;
}

export type ExecutionStore = Store<ExecutionState>;

export const INITIAL_EXECUTION_STATE: ExecutionState = {
    steps: [],
    prints: [],
    currentStep: null,
    playing: false,
    active: false,
};
