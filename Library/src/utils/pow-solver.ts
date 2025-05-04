// File: pow-solver.ts (Ported from working deepseek_pow.js logic)

import Browser from "webextension-polyfill";

// --- Interfaces ---
interface DeepSeekChallenge {
    algorithm: string;
    challenge: string;
    salt: string;
    signature: string;
    difficulty: number;
    expire_at: number; // Crucial for the working prefix
    expire_after: number;
    target_path?: string;
}

// --- WasmExports Interface (matches previous successful load) ---
interface WasmExports {
    memory: WebAssembly.Memory;
    wasm_solve: (resultStackPtr: number, challengePtr: number, challengeLen: number, prefixPtr: number, prefixLen: number, difficulty: number) => void;
    __wbindgen_export_0: (size: number, align: number) => number; // Malloc
    __wbindgen_export_1: (ptr: number, size: number, param3_maybe_align: number, align: number) => number; // Free
    __wbindgen_export_2: (ptr: number, old_size: number, new_size: number, align: number) => number; // Realloc
    __wbindgen_add_to_stack_pointer: (delta: number) => number;
}

// --- WASM State & Extracted Logic ---
let wasmExports: WasmExports | null = null;
let wasmMemory: WebAssembly.Memory | null = null;
let wasmInitPromise: Promise<WasmExports> | null = null;

// --- Extracted JS Helpers (Keep as before) ---
let heap: Uint8Array = new Uint8Array(0);
let dataView: DataView = new DataView(new ArrayBuffer(0));

function updateMemoryViews() {
    if (!wasmMemory) throw new Error("WASM Memory not initialized for view update");
    if (heap.buffer !== wasmMemory.buffer) {
        heap = new Uint8Array(wasmMemory.buffer);
        dataView = new DataView(wasmMemory.buffer);
    }
}

const TEXT_DECODER = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
const TEXT_ENCODER = new TextEncoder();

function getStringFromWasm0(ptr: number, len: number): string {
    if (len === 0) return "";
    updateMemoryViews();
    return TEXT_DECODER.decode(heap.subarray(ptr, ptr + len));
}

let heapObjectTable: any[] = [undefined, null, true, false];
let heapObjectTableNextIdx = heapObjectTable.length;

function addHeapObject(obj: any): number {
    if (heapObjectTableNextIdx === heapObjectTable.length) heapObjectTable.push(heapObjectTable.length + 1);
    const idx = heapObjectTableNextIdx;
    heapObjectTableNextIdx = heapObjectTable[idx];
    heapObjectTable[idx] = obj;
    return idx;
}

function getObject(idx: number): any { return heapObjectTable[idx]; }

function dropObject(idx: number) {
    if (idx < 4) return;
    const obj = heapObjectTable[idx];
    if (obj !== undefined) {
        heapObjectTable[idx] = heapObjectTableNextIdx;
        heapObjectTableNextIdx = idx;
    }
}

function takeObject(idx: number): any {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let WASM_VECTOR_LEN = 0;

function passStringToWasm0(arg: string, malloc: (size: number, align: number) => number): number {
    const buf = TEXT_ENCODER.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    updateMemoryViews();
    heap.subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
}

function readInt32FromMemory(ptr: number): number {
    updateMemoryViews();
    if (ptr <= 0 || ptr + 4 > dataView.byteLength) {
        console.error(`readInt32FromMemory: Invalid pointer ${ptr}. Buffer size: ${dataView.byteLength}`);
        return 0;
    }
    if (ptr % 4 !== 0) {
        console.warn(`readInt32FromMemory: Pointer ${ptr} is not 4-byte aligned.`);
    }
    return dataView.getInt32(ptr, true); // true for little-endian
}

// --- NEW: Read Float64 from memory ---
function readFloat64FromMemory(ptr: number): number {
    updateMemoryViews();
    if (ptr <= 0 || ptr + 8 > dataView.byteLength) {
        console.error(`readFloat64FromMemory: Invalid pointer ${ptr}. Buffer size: ${dataView.byteLength}`);
        return NaN; // Or throw error
    }
    if (ptr % 8 !== 0) {
        console.warn(`readFloat64FromMemory: Pointer ${ptr} is not 8-byte aligned.`);
    }
    return dataView.getFloat64(ptr, true); // true for little-endian
}

function writeBytesToMemory(bytes: Uint8Array, ptr: number): void {
    updateMemoryViews();
    if (ptr <= 0 || ptr + bytes.length > heap.byteLength) {
        console.error(`writeBytesToMemory: Invalid pointer ${ptr} or length ${bytes.length}. Buffer size: ${heap.byteLength}`);
        throw new Error("Attempted to write outside WASM memory bounds");
    }
    heap.set(bytes, ptr);
}

function stringToBytes(str: string): Uint8Array {
    return TEXT_ENCODER.encode(str);
}

// --- The Extracted `env` Object (Keep as before) ---
const wbindgenImports = { /* ... same successful imports ... */
    __wbindgen_string_new: (ptr: number, len: number) => addHeapObject(getStringFromWasm0(ptr, len)),
    __wbindgen_object_clone_ref: (idx: number) => addHeapObject(getObject(idx)),
    __wbindgen_object_drop_ref: dropObject,
    __wbindgen_throw: (ptr: number, len: number) => { throw new Error(getStringFromWasm0(ptr, len)); },
    __wbindgen_number_new: (v: number): number => addHeapObject(v),
    __wbindgen_number_get: (handle: number, retPtr: number): void => {
        if (!wasmMemory) throw new Error("WASM memory not available");
        updateMemoryViews();
        const value = getObject(handle);
        if (typeof value === 'number') {
            dataView.setFloat64(retPtr, value, true);
            dataView.setInt32(retPtr + 8, 0, true);
        } else {
            dataView.setFloat64(retPtr, NaN, true);
            dataView.setInt32(retPtr + 8, 1, true);
        }
    },
    __wbindgen_is_undefined: (handle: number): boolean => getObject(handle) === undefined,
    __wbindgen_boolean_get: (handle: number): number => {
        const value = getObject(handle);
        return typeof value === 'boolean' ? (value ? 1 : 0) : 2;
    },
    __wbindgen_string_get: (handle: number, retPtr: number): void => {
        if (!wasmMemory || !wasmExports?.__wbindgen_export_0) {
            console.error("WASM memory or malloc (__wbindgen_export_0) not available for __wbindgen_string_get");
            if (wasmMemory) {
                updateMemoryViews();
                dataView.setInt32(retPtr, 0, true);
                dataView.setInt32(retPtr + 4, 0, true);
            }
            return;
        }
        updateMemoryViews();
        const value = getObject(handle);
        if (typeof value === 'string') {
            const ptr = passStringToWasm0(value, wasmExports.__wbindgen_export_0);
            const len = WASM_VECTOR_LEN;
            dataView.setInt32(retPtr, ptr, true);
            dataView.setInt32(retPtr + 4, len, true);
        } else {
            dataView.setInt32(retPtr, 0, true);
            dataView.setInt32(retPtr + 4, 0, true);
        }
    },
    __wbindgen_error_new: (ptr: number, len: number): number => addHeapObject(new Error(getStringFromWasm0(ptr, len))),
    __wbindgen_jsval_loose_eq: (a: number, b: number): boolean => getObject(a) == getObject(b),
    crypto_getRandomValues: (ptr: number, len: number): void => {
        updateMemoryViews();
        crypto.getRandomValues(heap.subarray(ptr, ptr + len));
    },
    performance_now: (): number => performance.now(),
    __wbindgen_thread_destroy: () => { console.warn("STUB: __wbindgen_thread_destroy called"); },
    __wbindgen_current_thread_destroy: () => { console.warn("STUB: __wbindgen_current_thread_destroy called"); },
    __wbindgen_thread_spawn: (ptr: number): number => { console.warn("STUB: __wbindgen_thread_spawn called with ptr:", ptr); return 0; },
    __wbindgen_cb_drop: (handle: number): boolean => {
        const cb = getObject(handle);
        if (typeof cb === 'function') { dropObject(handle); return true; }
        return false;
    },
};

// --- WASM Loader (Keep the same) ---
async function loadWasmOnce(): Promise<WasmExports> { /* ... same ... */
    if (wasmInitPromise) {
        return wasmInitPromise;
    }
    wasmInitPromise = (async (): Promise<WasmExports> => {
        if (wasmExports) return wasmExports;

        const wasmPath = Browser.runtime.getURL('assets/sha3_wasm_bg.7b9ca65ddd.wasm');
        console.log('Initializing DeepSeek WASM from:', wasmPath);

        try {
            const fetchPromise = fetch(wasmPath);
            wasmMemory = new WebAssembly.Memory({ initial: 17, maximum: 16384, shared: false });
            updateMemoryViews();

            const importObject = {
                env: {
                    ...wbindgenImports,
                    memory: wasmMemory
                }
            };

            console.log("Attempting WASM instantiation with imports:", Object.keys(importObject.env));
            const { instance } = await WebAssembly.instantiateStreaming(fetchPromise, importObject);

            if (instance.exports.memory instanceof WebAssembly.Memory && instance.exports.memory !== wasmMemory) {
                console.log("WASM module exported its own memory instance. Updating reference.");
                wasmMemory = instance.exports.memory;
                updateMemoryViews();
            } else {
                console.log("WASM using provided memory instance.");
            }

            wasmExports = instance.exports as unknown as WasmExports;
            console.log('DeepSeek WASM module loaded and initialized successfully.');

            heapObjectTable = [undefined, null, true, false];
            heapObjectTableNextIdx = heapObjectTable.length;

            return wasmExports;

        } catch (error: any) {
            console.error('Failed to load or instantiate WASM module:', error);
            wasmMemory = null;
            wasmExports = null;
            wasmInitPromise = null;
            heapObjectTable = [undefined, null, true, false];
            heapObjectTableNextIdx = heapObjectTable.length;
            throw error;
        }
    })();
    return wasmInitPromise;
}


/**
 * Solves the PoW challenge using the loaded WASM and logic from the working JS example.
 */
export async function solveDeepSeekPowWasm(challengeObj: DeepSeekChallenge): Promise<string> {
    console.log("Starting PoW solve using WASM (Ported JS Logic):", challengeObj);

    if (challengeObj.algorithm !== 'DeepSeekHashV1') {
        throw new Error('Unsupported PoW algorithm: ' + challengeObj.algorithm);
    }
    if (typeof challengeObj.difficulty !== 'number') {
        throw new Error('Missing difficulty in challenge object');
    }
    if (typeof challengeObj.expire_at !== 'number') {
        throw new Error('Missing expire_at in challenge object');
    }

    const currentWasmExports = await loadWasmOnce();
    if (!currentWasmExports || !wasmMemory) {
        throw new Error('WASM module is not initialized.');
    }

    const {
        __wbindgen_export_0: wasmMalloc,
        __wbindgen_export_1: wasmFree,
        __wbindgen_add_to_stack_pointer: wasmStackPtrAdd,
        wasm_solve
    } = currentWasmExports;

    if (!wasmMalloc || !wasmFree || !wasmStackPtrAdd || !wasm_solve) {
        console.error("Available WASM exports:", Object.keys(currentWasmExports));
        throw new Error('Required WASM exports not found after loading.');
    }

    updateMemoryViews();

    // --- Prepare Input Data (Using logic from working JS) ---
    const { challenge, salt, difficulty, signature, target_path, expire_at } = challengeObj;
    const challengeStr = challenge; // Use original hex string
    const prefixStr = `${salt}_${expire_at}_`; // Prefix used in working JS

    const stackAllocSize = 16; // Enough for status (i32) + nonce (f64)

    let challengePtr = 0;
    let prefixPtr = 0;
    let challengeLen = 0;
    let prefixLen = 0;
    let resultStackPtr = 0;
    let stackPointerRestored = false;
    let solvedAnswer: number | null = null;

    try {
        // --- Allocate memory for strings (UTF-8 bytes) ---
        challengePtr = passStringToWasm0(challengeStr, wasmMalloc);
        challengeLen = WASM_VECTOR_LEN;
        prefixPtr = passStringToWasm0(prefixStr, wasmMalloc);
        prefixLen = WASM_VECTOR_LEN;

        if (challengePtr === 0 || prefixPtr === 0) {
            // Attempt cleanup
            if (wasmFree) {
                if (challengePtr !== 0) try { wasmFree(challengePtr, challengeLen, 1, 1); } catch (e) { }
                if (prefixPtr !== 0) try { wasmFree(prefixPtr, prefixLen, 1, 1); } catch (e) { }
            }
            throw new Error(`WASM malloc failed. Pointers: C=${challengePtr}, P=${prefixPtr}`);
        }

        // --- Allocate space on stack for result ---
        resultStackPtr = wasmStackPtrAdd(-stackAllocSize);
        if (resultStackPtr <= 0) {
            throw new Error(`WASM failed to adjust stack pointer correctly (returned ${resultStackPtr}).`);
        }
        // Alignment checks for reading both i32 and f64
        if (resultStackPtr % 8 !== 0) {
            console.warn(`Result stack pointer ${resultStackPtr} is not 8-byte aligned. Reading f64 might be problematic.`);
        } else if (resultStackPtr % 4 !== 0) {
            console.warn(`Result stack pointer ${resultStackPtr} is not 4-byte aligned. Reading i32 might be problematic.`);
        }

        console.log(`Calling wasm_solve with:
          arg0 (resultStackPtr): ${resultStackPtr}
          arg1 (challengePtr):   ${challengePtr} (len: ${challengeLen}) -> "${challengeStr}"
          arg2 (challengeLen):   ${challengeLen}
          arg3 (prefixPtr):      ${prefixPtr} (len: ${prefixLen}) -> "${prefixStr}"
          arg4 (prefixLen):      ${prefixLen}
          arg5 (difficulty):     ${Number(difficulty)}`);

        // --- Call the WASM function ---
        const startTime = performance.now();
        wasm_solve(
            resultStackPtr,
            challengePtr, challengeLen,
            prefixPtr, prefixLen,
            Number(difficulty) // Pass float difficulty
        );
        const endTime = performance.now();
        console.log(`wasm_solve execution time: ${endTime - startTime} ms`);

        // --- Read Result (Ported Logic) ---
        const status = readInt32FromMemory(resultStackPtr); // Read i32 status code
        console.log(`WASM solve completed. Read status from stack [${resultStackPtr}]: ${status}`);

        if (status === 0) {
            console.error("WASM solve function indicated failure (status code 0).");
            solvedAnswer = null; // Explicitly null on failure
            // Optionally throw an error instead of returning null answer later
            throw new Error("WASM solver failed internally (returned status 0).");
        } else {
            // If status != 0, read the f64 nonce from offset 8
            const nonceFloat = readFloat64FromMemory(resultStackPtr + 8);
            console.log(`WASM solve success (status ${status}). Read f64 nonce from stack [${resultStackPtr + 8}]: ${nonceFloat}`);
            solvedAnswer = Math.floor(nonceFloat); // Floor the result
        }

        console.log(`Final calculated nonce: ${solvedAnswer}`);

        // --- Restore stack pointer ---
        wasmStackPtrAdd(stackAllocSize);
        stackPointerRestored = true;

        // Check if we got a valid number answer
        if (solvedAnswer === null || typeof solvedAnswer !== 'number' || isNaN(solvedAnswer)) {
            throw new Error(`PoW solver did not produce a valid number answer (got: ${solvedAnswer}).`);
        }

        // --- Construct the final JSON payload ---
        const solutionObj = {
            algorithm: challengeObj.algorithm,
            challenge: challenge,
            salt: salt,
            answer: solvedAnswer, // Use the floored number
            signature: signature,
            target_path: target_path || "/api/v0/chat/completion"
        };

        const jsonStr = JSON.stringify(solutionObj);
        const base64Solution = btoa(jsonStr);

        return base64Solution;

    } catch (err: any) {
        console.error("Error caught during WASM PoW solve:", err);
        // ... (keep existing error logging) ...
        if (wasmStackPtrAdd && resultStackPtr > 0 && !stackPointerRestored) {
            try { wasmStackPtrAdd(stackAllocSize); console.log("Restored stack pointer in error handler."); }
            catch (e) { console.error("Error restoring stack pointer after error:", e); }
        }
        throw err; // Re-throw the original error

    }
}