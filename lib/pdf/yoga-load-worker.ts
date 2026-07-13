// `@react-pdf/renderer` loads Yoga from an embedded base64 payload and asks
// WebAssembly to compile it at request time. Workerd forbids runtime WASM code
// generation, so the Worker build aliases `yoga-layout/load` to this module and
// imports the same binary as a precompiled module instead.

// @ts-expect-error -- Yoga does not publish types for its internal Emscripten loader.
import loadYogaImpl from "../../node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js";
import wrapAssembly from "../../node_modules/yoga-layout/dist/src/wrapAssembly.js";
import yogaWasmModule from "./yoga.wasm";

export * from "../../node_modules/yoga-layout/dist/src/generated/YGEnums.js";

type YogaModuleFactory = (options: {
  instantiateWasm: (
    imports: WebAssembly.Imports,
    receiveInstance: (instance: WebAssembly.Instance) => void,
  ) => WebAssembly.Exports;
}) => Promise<unknown>;

export async function loadYoga() {
  const factory = loadYogaImpl as YogaModuleFactory;
  const assembly = await factory({
    instantiateWasm(imports, receiveInstance) {
      const instance = new WebAssembly.Instance(yogaWasmModule, imports);
      receiveInstance(instance);
      return instance.exports;
    },
  });

  return wrapAssembly(assembly as Parameters<typeof wrapAssembly>[0]);
}
