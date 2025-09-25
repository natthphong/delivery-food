const emptyArray: never[] = [];
const emptyObject: Record<string, never> = {};

Object.freeze(emptyArray);
Object.freeze(emptyObject);

export const EMPTY_ARRAY: never[] = emptyArray;
export const EMPTY_OBJECT: Record<string, never> = emptyObject;
