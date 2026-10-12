import source from "../../../../examples/example-adapter/src/adapter.ts?raw";

// Keep the actual checked example, omitting its explanatory block comment.
export const adapterExample = source.replace(/\/\*\*[\s\S]*?\*\//g, "");
