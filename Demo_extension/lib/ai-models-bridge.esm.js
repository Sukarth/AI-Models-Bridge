/**
 * Error codes for AI model errors
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UNKNOWN_ERROR"] = "unknown_error";
    ErrorCode["NETWORK_ERROR"] = "network_error";
    ErrorCode["UNAUTHORIZED"] = "unauthorized";
    ErrorCode["SERVICE_UNAVAILABLE"] = "service_unavailable";
    ErrorCode["MISSING_API_KEY"] = "missing_api_key";
    ErrorCode["MISSING_HOST_PERMISSION"] = "missing_host_permission";
    ErrorCode["CONVERSATION_LIMIT"] = "conversation_limit";
    ErrorCode["CONTENT_FILTERED"] = "content_filtered";
    ErrorCode["INVALID_REQUEST"] = "invalid_request";
})(ErrorCode || (ErrorCode = {}));
/**
 * Error class for AI model errors
 */
class AIModelError extends Error {
    constructor(message, code = ErrorCode.UNKNOWN_ERROR) {
        super(message);
        this.code = code;
        this.name = 'AIModelError';
    }
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var browserPolyfill = {exports: {}};

(function (module, exports) {
	(function (global, factory) {
	  {
	    factory(module);
	  }
	})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : commonjsGlobal, function (module) {

	  if (!globalThis.chrome?.runtime?.id) {
	    throw new Error("This script should only be loaded in a browser extension.");
	  }

	  if (typeof globalThis.browser === "undefined" || Object.getPrototypeOf(globalThis.browser) !== Object.prototype) {
	    const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received."; // Wrapping the bulk of this polyfill in a one-time-use function is a minor
	    // optimization for Firefox. Since Spidermonkey does not fully parse the
	    // contents of a function until the first time it's called, and since it will
	    // never actually need to be called, this allows the polyfill to be included
	    // in Firefox nearly for free.

	    const wrapAPIs = extensionAPIs => {
	      // NOTE: apiMetadata is associated to the content of the api-metadata.json file
	      // at build time by replacing the following "include" with the content of the
	      // JSON file.
	      const apiMetadata = {
	        "alarms": {
	          "clear": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "clearAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "get": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "getAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          }
	        },
	        "bookmarks": {
	          "create": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "get": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getChildren": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getRecent": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getSubTree": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getTree": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "move": {
	            "minArgs": 2,
	            "maxArgs": 2
	          },
	          "remove": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeTree": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "search": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "update": {
	            "minArgs": 2,
	            "maxArgs": 2
	          }
	        },
	        "browserAction": {
	          "disable": {
	            "minArgs": 0,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "enable": {
	            "minArgs": 0,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "getBadgeBackgroundColor": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getBadgeText": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getPopup": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getTitle": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "openPopup": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "setBadgeBackgroundColor": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "setBadgeText": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "setIcon": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "setPopup": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "setTitle": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          }
	        },
	        "browsingData": {
	          "remove": {
	            "minArgs": 2,
	            "maxArgs": 2
	          },
	          "removeCache": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeCookies": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeDownloads": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeFormData": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeHistory": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeLocalStorage": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removePasswords": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removePluginData": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "settings": {
	            "minArgs": 0,
	            "maxArgs": 0
	          }
	        },
	        "commands": {
	          "getAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          }
	        },
	        "contextMenus": {
	          "remove": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "update": {
	            "minArgs": 2,
	            "maxArgs": 2
	          }
	        },
	        "cookies": {
	          "get": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getAll": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getAllCookieStores": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "remove": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "set": {
	            "minArgs": 1,
	            "maxArgs": 1
	          }
	        },
	        "devtools": {
	          "inspectedWindow": {
	            "eval": {
	              "minArgs": 1,
	              "maxArgs": 2,
	              "singleCallbackArg": false
	            }
	          },
	          "panels": {
	            "create": {
	              "minArgs": 3,
	              "maxArgs": 3,
	              "singleCallbackArg": true
	            },
	            "elements": {
	              "createSidebarPane": {
	                "minArgs": 1,
	                "maxArgs": 1
	              }
	            }
	          }
	        },
	        "downloads": {
	          "cancel": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "download": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "erase": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getFileIcon": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "open": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "pause": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeFile": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "resume": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "search": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "show": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          }
	        },
	        "extension": {
	          "isAllowedFileSchemeAccess": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "isAllowedIncognitoAccess": {
	            "minArgs": 0,
	            "maxArgs": 0
	          }
	        },
	        "history": {
	          "addUrl": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "deleteAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "deleteRange": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "deleteUrl": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getVisits": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "search": {
	            "minArgs": 1,
	            "maxArgs": 1
	          }
	        },
	        "i18n": {
	          "detectLanguage": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getAcceptLanguages": {
	            "minArgs": 0,
	            "maxArgs": 0
	          }
	        },
	        "identity": {
	          "launchWebAuthFlow": {
	            "minArgs": 1,
	            "maxArgs": 1
	          }
	        },
	        "idle": {
	          "queryState": {
	            "minArgs": 1,
	            "maxArgs": 1
	          }
	        },
	        "management": {
	          "get": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "getSelf": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "setEnabled": {
	            "minArgs": 2,
	            "maxArgs": 2
	          },
	          "uninstallSelf": {
	            "minArgs": 0,
	            "maxArgs": 1
	          }
	        },
	        "notifications": {
	          "clear": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "create": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "getAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "getPermissionLevel": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "update": {
	            "minArgs": 2,
	            "maxArgs": 2
	          }
	        },
	        "pageAction": {
	          "getPopup": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getTitle": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "hide": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "setIcon": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "setPopup": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "setTitle": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          },
	          "show": {
	            "minArgs": 1,
	            "maxArgs": 1,
	            "fallbackToNoCallback": true
	          }
	        },
	        "permissions": {
	          "contains": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getAll": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "remove": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "request": {
	            "minArgs": 1,
	            "maxArgs": 1
	          }
	        },
	        "runtime": {
	          "getBackgroundPage": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "getPlatformInfo": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "openOptionsPage": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "requestUpdateCheck": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "sendMessage": {
	            "minArgs": 1,
	            "maxArgs": 3
	          },
	          "sendNativeMessage": {
	            "minArgs": 2,
	            "maxArgs": 2
	          },
	          "setUninstallURL": {
	            "minArgs": 1,
	            "maxArgs": 1
	          }
	        },
	        "sessions": {
	          "getDevices": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "getRecentlyClosed": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "restore": {
	            "minArgs": 0,
	            "maxArgs": 1
	          }
	        },
	        "storage": {
	          "local": {
	            "clear": {
	              "minArgs": 0,
	              "maxArgs": 0
	            },
	            "get": {
	              "minArgs": 0,
	              "maxArgs": 1
	            },
	            "getBytesInUse": {
	              "minArgs": 0,
	              "maxArgs": 1
	            },
	            "remove": {
	              "minArgs": 1,
	              "maxArgs": 1
	            },
	            "set": {
	              "minArgs": 1,
	              "maxArgs": 1
	            }
	          },
	          "managed": {
	            "get": {
	              "minArgs": 0,
	              "maxArgs": 1
	            },
	            "getBytesInUse": {
	              "minArgs": 0,
	              "maxArgs": 1
	            }
	          },
	          "sync": {
	            "clear": {
	              "minArgs": 0,
	              "maxArgs": 0
	            },
	            "get": {
	              "minArgs": 0,
	              "maxArgs": 1
	            },
	            "getBytesInUse": {
	              "minArgs": 0,
	              "maxArgs": 1
	            },
	            "remove": {
	              "minArgs": 1,
	              "maxArgs": 1
	            },
	            "set": {
	              "minArgs": 1,
	              "maxArgs": 1
	            }
	          }
	        },
	        "tabs": {
	          "captureVisibleTab": {
	            "minArgs": 0,
	            "maxArgs": 2
	          },
	          "create": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "detectLanguage": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "discard": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "duplicate": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "executeScript": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "get": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getCurrent": {
	            "minArgs": 0,
	            "maxArgs": 0
	          },
	          "getZoom": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "getZoomSettings": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "goBack": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "goForward": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "highlight": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "insertCSS": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "move": {
	            "minArgs": 2,
	            "maxArgs": 2
	          },
	          "query": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "reload": {
	            "minArgs": 0,
	            "maxArgs": 2
	          },
	          "remove": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "removeCSS": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "sendMessage": {
	            "minArgs": 2,
	            "maxArgs": 3
	          },
	          "setZoom": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "setZoomSettings": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "update": {
	            "minArgs": 1,
	            "maxArgs": 2
	          }
	        },
	        "topSites": {
	          "get": {
	            "minArgs": 0,
	            "maxArgs": 0
	          }
	        },
	        "webNavigation": {
	          "getAllFrames": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "getFrame": {
	            "minArgs": 1,
	            "maxArgs": 1
	          }
	        },
	        "webRequest": {
	          "handlerBehaviorChanged": {
	            "minArgs": 0,
	            "maxArgs": 0
	          }
	        },
	        "windows": {
	          "create": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "get": {
	            "minArgs": 1,
	            "maxArgs": 2
	          },
	          "getAll": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "getCurrent": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "getLastFocused": {
	            "minArgs": 0,
	            "maxArgs": 1
	          },
	          "remove": {
	            "minArgs": 1,
	            "maxArgs": 1
	          },
	          "update": {
	            "minArgs": 2,
	            "maxArgs": 2
	          }
	        }
	      };

	      if (Object.keys(apiMetadata).length === 0) {
	        throw new Error("api-metadata.json has not been included in browser-polyfill");
	      }
	      /**
	       * A WeakMap subclass which creates and stores a value for any key which does
	       * not exist when accessed, but behaves exactly as an ordinary WeakMap
	       * otherwise.
	       *
	       * @param {function} createItem
	       *        A function which will be called in order to create the value for any
	       *        key which does not exist, the first time it is accessed. The
	       *        function receives, as its only argument, the key being created.
	       */


	      class DefaultWeakMap extends WeakMap {
	        constructor(createItem, items = undefined) {
	          super(items);
	          this.createItem = createItem;
	        }

	        get(key) {
	          if (!this.has(key)) {
	            this.set(key, this.createItem(key));
	          }

	          return super.get(key);
	        }

	      }
	      /**
	       * Returns true if the given object is an object with a `then` method, and can
	       * therefore be assumed to behave as a Promise.
	       *
	       * @param {*} value The value to test.
	       * @returns {boolean} True if the value is thenable.
	       */


	      const isThenable = value => {
	        return value && typeof value === "object" && typeof value.then === "function";
	      };
	      /**
	       * Creates and returns a function which, when called, will resolve or reject
	       * the given promise based on how it is called:
	       *
	       * - If, when called, `chrome.runtime.lastError` contains a non-null object,
	       *   the promise is rejected with that value.
	       * - If the function is called with exactly one argument, the promise is
	       *   resolved to that value.
	       * - Otherwise, the promise is resolved to an array containing all of the
	       *   function's arguments.
	       *
	       * @param {object} promise
	       *        An object containing the resolution and rejection functions of a
	       *        promise.
	       * @param {function} promise.resolve
	       *        The promise's resolution function.
	       * @param {function} promise.reject
	       *        The promise's rejection function.
	       * @param {object} metadata
	       *        Metadata about the wrapped method which has created the callback.
	       * @param {boolean} metadata.singleCallbackArg
	       *        Whether or not the promise is resolved with only the first
	       *        argument of the callback, alternatively an array of all the
	       *        callback arguments is resolved. By default, if the callback
	       *        function is invoked with only a single argument, that will be
	       *        resolved to the promise, while all arguments will be resolved as
	       *        an array if multiple are given.
	       *
	       * @returns {function}
	       *        The generated callback function.
	       */


	      const makeCallback = (promise, metadata) => {
	        return (...callbackArgs) => {
	          if (extensionAPIs.runtime.lastError) {
	            promise.reject(new Error(extensionAPIs.runtime.lastError.message));
	          } else if (metadata.singleCallbackArg || callbackArgs.length <= 1 && metadata.singleCallbackArg !== false) {
	            promise.resolve(callbackArgs[0]);
	          } else {
	            promise.resolve(callbackArgs);
	          }
	        };
	      };

	      const pluralizeArguments = numArgs => numArgs == 1 ? "argument" : "arguments";
	      /**
	       * Creates a wrapper function for a method with the given name and metadata.
	       *
	       * @param {string} name
	       *        The name of the method which is being wrapped.
	       * @param {object} metadata
	       *        Metadata about the method being wrapped.
	       * @param {integer} metadata.minArgs
	       *        The minimum number of arguments which must be passed to the
	       *        function. If called with fewer than this number of arguments, the
	       *        wrapper will raise an exception.
	       * @param {integer} metadata.maxArgs
	       *        The maximum number of arguments which may be passed to the
	       *        function. If called with more than this number of arguments, the
	       *        wrapper will raise an exception.
	       * @param {boolean} metadata.singleCallbackArg
	       *        Whether or not the promise is resolved with only the first
	       *        argument of the callback, alternatively an array of all the
	       *        callback arguments is resolved. By default, if the callback
	       *        function is invoked with only a single argument, that will be
	       *        resolved to the promise, while all arguments will be resolved as
	       *        an array if multiple are given.
	       *
	       * @returns {function(object, ...*)}
	       *       The generated wrapper function.
	       */


	      const wrapAsyncFunction = (name, metadata) => {
	        return function asyncFunctionWrapper(target, ...args) {
	          if (args.length < metadata.minArgs) {
	            throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
	          }

	          if (args.length > metadata.maxArgs) {
	            throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
	          }

	          return new Promise((resolve, reject) => {
	            if (metadata.fallbackToNoCallback) {
	              // This API method has currently no callback on Chrome, but it return a promise on Firefox,
	              // and so the polyfill will try to call it with a callback first, and it will fallback
	              // to not passing the callback if the first call fails.
	              try {
	                target[name](...args, makeCallback({
	                  resolve,
	                  reject
	                }, metadata));
	              } catch (cbError) {
	                console.warn(`${name} API method doesn't seem to support the callback parameter, ` + "falling back to call it without a callback: ", cbError);
	                target[name](...args); // Update the API method metadata, so that the next API calls will not try to
	                // use the unsupported callback anymore.

	                metadata.fallbackToNoCallback = false;
	                metadata.noCallback = true;
	                resolve();
	              }
	            } else if (metadata.noCallback) {
	              target[name](...args);
	              resolve();
	            } else {
	              target[name](...args, makeCallback({
	                resolve,
	                reject
	              }, metadata));
	            }
	          });
	        };
	      };
	      /**
	       * Wraps an existing method of the target object, so that calls to it are
	       * intercepted by the given wrapper function. The wrapper function receives,
	       * as its first argument, the original `target` object, followed by each of
	       * the arguments passed to the original method.
	       *
	       * @param {object} target
	       *        The original target object that the wrapped method belongs to.
	       * @param {function} method
	       *        The method being wrapped. This is used as the target of the Proxy
	       *        object which is created to wrap the method.
	       * @param {function} wrapper
	       *        The wrapper function which is called in place of a direct invocation
	       *        of the wrapped method.
	       *
	       * @returns {Proxy<function>}
	       *        A Proxy object for the given method, which invokes the given wrapper
	       *        method in its place.
	       */


	      const wrapMethod = (target, method, wrapper) => {
	        return new Proxy(method, {
	          apply(targetMethod, thisObj, args) {
	            return wrapper.call(thisObj, target, ...args);
	          }

	        });
	      };

	      let hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);
	      /**
	       * Wraps an object in a Proxy which intercepts and wraps certain methods
	       * based on the given `wrappers` and `metadata` objects.
	       *
	       * @param {object} target
	       *        The target object to wrap.
	       *
	       * @param {object} [wrappers = {}]
	       *        An object tree containing wrapper functions for special cases. Any
	       *        function present in this object tree is called in place of the
	       *        method in the same location in the `target` object tree. These
	       *        wrapper methods are invoked as described in {@see wrapMethod}.
	       *
	       * @param {object} [metadata = {}]
	       *        An object tree containing metadata used to automatically generate
	       *        Promise-based wrapper functions for asynchronous. Any function in
	       *        the `target` object tree which has a corresponding metadata object
	       *        in the same location in the `metadata` tree is replaced with an
	       *        automatically-generated wrapper function, as described in
	       *        {@see wrapAsyncFunction}
	       *
	       * @returns {Proxy<object>}
	       */

	      const wrapObject = (target, wrappers = {}, metadata = {}) => {
	        let cache = Object.create(null);
	        let handlers = {
	          has(proxyTarget, prop) {
	            return prop in target || prop in cache;
	          },

	          get(proxyTarget, prop, receiver) {
	            if (prop in cache) {
	              return cache[prop];
	            }

	            if (!(prop in target)) {
	              return undefined;
	            }

	            let value = target[prop];

	            if (typeof value === "function") {
	              // This is a method on the underlying object. Check if we need to do
	              // any wrapping.
	              if (typeof wrappers[prop] === "function") {
	                // We have a special-case wrapper for this method.
	                value = wrapMethod(target, target[prop], wrappers[prop]);
	              } else if (hasOwnProperty(metadata, prop)) {
	                // This is an async method that we have metadata for. Create a
	                // Promise wrapper for it.
	                let wrapper = wrapAsyncFunction(prop, metadata[prop]);
	                value = wrapMethod(target, target[prop], wrapper);
	              } else {
	                // This is a method that we don't know or care about. Return the
	                // original method, bound to the underlying object.
	                value = value.bind(target);
	              }
	            } else if (typeof value === "object" && value !== null && (hasOwnProperty(wrappers, prop) || hasOwnProperty(metadata, prop))) {
	              // This is an object that we need to do some wrapping for the children
	              // of. Create a sub-object wrapper for it with the appropriate child
	              // metadata.
	              value = wrapObject(value, wrappers[prop], metadata[prop]);
	            } else if (hasOwnProperty(metadata, "*")) {
	              // Wrap all properties in * namespace.
	              value = wrapObject(value, wrappers[prop], metadata["*"]);
	            } else {
	              // We don't need to do any wrapping for this property,
	              // so just forward all access to the underlying object.
	              Object.defineProperty(cache, prop, {
	                configurable: true,
	                enumerable: true,

	                get() {
	                  return target[prop];
	                },

	                set(value) {
	                  target[prop] = value;
	                }

	              });
	              return value;
	            }

	            cache[prop] = value;
	            return value;
	          },

	          set(proxyTarget, prop, value, receiver) {
	            if (prop in cache) {
	              cache[prop] = value;
	            } else {
	              target[prop] = value;
	            }

	            return true;
	          },

	          defineProperty(proxyTarget, prop, desc) {
	            return Reflect.defineProperty(cache, prop, desc);
	          },

	          deleteProperty(proxyTarget, prop) {
	            return Reflect.deleteProperty(cache, prop);
	          }

	        }; // Per contract of the Proxy API, the "get" proxy handler must return the
	        // original value of the target if that value is declared read-only and
	        // non-configurable. For this reason, we create an object with the
	        // prototype set to `target` instead of using `target` directly.
	        // Otherwise we cannot return a custom object for APIs that
	        // are declared read-only and non-configurable, such as `chrome.devtools`.
	        //
	        // The proxy handlers themselves will still use the original `target`
	        // instead of the `proxyTarget`, so that the methods and properties are
	        // dereferenced via the original targets.

	        let proxyTarget = Object.create(target);
	        return new Proxy(proxyTarget, handlers);
	      };
	      /**
	       * Creates a set of wrapper functions for an event object, which handles
	       * wrapping of listener functions that those messages are passed.
	       *
	       * A single wrapper is created for each listener function, and stored in a
	       * map. Subsequent calls to `addListener`, `hasListener`, or `removeListener`
	       * retrieve the original wrapper, so that  attempts to remove a
	       * previously-added listener work as expected.
	       *
	       * @param {DefaultWeakMap<function, function>} wrapperMap
	       *        A DefaultWeakMap object which will create the appropriate wrapper
	       *        for a given listener function when one does not exist, and retrieve
	       *        an existing one when it does.
	       *
	       * @returns {object}
	       */


	      const wrapEvent = wrapperMap => ({
	        addListener(target, listener, ...args) {
	          target.addListener(wrapperMap.get(listener), ...args);
	        },

	        hasListener(target, listener) {
	          return target.hasListener(wrapperMap.get(listener));
	        },

	        removeListener(target, listener) {
	          target.removeListener(wrapperMap.get(listener));
	        }

	      });

	      const onRequestFinishedWrappers = new DefaultWeakMap(listener => {
	        if (typeof listener !== "function") {
	          return listener;
	        }
	        /**
	         * Wraps an onRequestFinished listener function so that it will return a
	         * `getContent()` property which returns a `Promise` rather than using a
	         * callback API.
	         *
	         * @param {object} req
	         *        The HAR entry object representing the network request.
	         */


	        return function onRequestFinished(req) {
	          const wrappedReq = wrapObject(req, {}
	          /* wrappers */
	          , {
	            getContent: {
	              minArgs: 0,
	              maxArgs: 0
	            }
	          });
	          listener(wrappedReq);
	        };
	      });
	      const onMessageWrappers = new DefaultWeakMap(listener => {
	        if (typeof listener !== "function") {
	          return listener;
	        }
	        /**
	         * Wraps a message listener function so that it may send responses based on
	         * its return value, rather than by returning a sentinel value and calling a
	         * callback. If the listener function returns a Promise, the response is
	         * sent when the promise either resolves or rejects.
	         *
	         * @param {*} message
	         *        The message sent by the other end of the channel.
	         * @param {object} sender
	         *        Details about the sender of the message.
	         * @param {function(*)} sendResponse
	         *        A callback which, when called with an arbitrary argument, sends
	         *        that value as a response.
	         * @returns {boolean}
	         *        True if the wrapped listener returned a Promise, which will later
	         *        yield a response. False otherwise.
	         */


	        return function onMessage(message, sender, sendResponse) {
	          let didCallSendResponse = false;
	          let wrappedSendResponse;
	          let sendResponsePromise = new Promise(resolve => {
	            wrappedSendResponse = function (response) {
	              didCallSendResponse = true;
	              resolve(response);
	            };
	          });
	          let result;

	          try {
	            result = listener(message, sender, wrappedSendResponse);
	          } catch (err) {
	            result = Promise.reject(err);
	          }

	          const isResultThenable = result !== true && isThenable(result); // If the listener didn't returned true or a Promise, or called
	          // wrappedSendResponse synchronously, we can exit earlier
	          // because there will be no response sent from this listener.

	          if (result !== true && !isResultThenable && !didCallSendResponse) {
	            return false;
	          } // A small helper to send the message if the promise resolves
	          // and an error if the promise rejects (a wrapped sendMessage has
	          // to translate the message into a resolved promise or a rejected
	          // promise).


	          const sendPromisedResult = promise => {
	            promise.then(msg => {
	              // send the message value.
	              sendResponse(msg);
	            }, error => {
	              // Send a JSON representation of the error if the rejected value
	              // is an instance of error, or the object itself otherwise.
	              let message;

	              if (error && (error instanceof Error || typeof error.message === "string")) {
	                message = error.message;
	              } else {
	                message = "An unexpected error occurred";
	              }

	              sendResponse({
	                __mozWebExtensionPolyfillReject__: true,
	                message
	              });
	            }).catch(err => {
	              // Print an error on the console if unable to send the response.
	              console.error("Failed to send onMessage rejected reply", err);
	            });
	          }; // If the listener returned a Promise, send the resolved value as a
	          // result, otherwise wait the promise related to the wrappedSendResponse
	          // callback to resolve and send it as a response.


	          if (isResultThenable) {
	            sendPromisedResult(result);
	          } else {
	            sendPromisedResult(sendResponsePromise);
	          } // Let Chrome know that the listener is replying.


	          return true;
	        };
	      });

	      const wrappedSendMessageCallback = ({
	        reject,
	        resolve
	      }, reply) => {
	        if (extensionAPIs.runtime.lastError) {
	          // Detect when none of the listeners replied to the sendMessage call and resolve
	          // the promise to undefined as in Firefox.
	          // See https://github.com/mozilla/webextension-polyfill/issues/130
	          if (extensionAPIs.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE) {
	            resolve();
	          } else {
	            reject(new Error(extensionAPIs.runtime.lastError.message));
	          }
	        } else if (reply && reply.__mozWebExtensionPolyfillReject__) {
	          // Convert back the JSON representation of the error into
	          // an Error instance.
	          reject(new Error(reply.message));
	        } else {
	          resolve(reply);
	        }
	      };

	      const wrappedSendMessage = (name, metadata, apiNamespaceObj, ...args) => {
	        if (args.length < metadata.minArgs) {
	          throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
	        }

	        if (args.length > metadata.maxArgs) {
	          throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
	        }

	        return new Promise((resolve, reject) => {
	          const wrappedCb = wrappedSendMessageCallback.bind(null, {
	            resolve,
	            reject
	          });
	          args.push(wrappedCb);
	          apiNamespaceObj.sendMessage(...args);
	        });
	      };

	      const staticWrappers = {
	        devtools: {
	          network: {
	            onRequestFinished: wrapEvent(onRequestFinishedWrappers)
	          }
	        },
	        runtime: {
	          onMessage: wrapEvent(onMessageWrappers),
	          onMessageExternal: wrapEvent(onMessageWrappers),
	          sendMessage: wrappedSendMessage.bind(null, "sendMessage", {
	            minArgs: 1,
	            maxArgs: 3
	          })
	        },
	        tabs: {
	          sendMessage: wrappedSendMessage.bind(null, "sendMessage", {
	            minArgs: 2,
	            maxArgs: 3
	          })
	        }
	      };
	      const settingMetadata = {
	        clear: {
	          minArgs: 1,
	          maxArgs: 1
	        },
	        get: {
	          minArgs: 1,
	          maxArgs: 1
	        },
	        set: {
	          minArgs: 1,
	          maxArgs: 1
	        }
	      };
	      apiMetadata.privacy = {
	        network: {
	          "*": settingMetadata
	        },
	        services: {
	          "*": settingMetadata
	        },
	        websites: {
	          "*": settingMetadata
	        }
	      };
	      return wrapObject(extensionAPIs, staticWrappers, apiMetadata);
	    }; // The build process adds a UMD wrapper around this file, which makes the
	    // `module` variable available.


	    module.exports = wrapAPIs(chrome);
	  } else {
	    module.exports = globalThis.browser;
	  }
	});
	
} (browserPolyfill));

var browserPolyfillExports = browserPolyfill.exports;
var Browser = /*@__PURE__*/getDefaultExportFromCjs(browserPolyfillExports);

// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
let getRandomValues;
const rnds8 = new Uint8Array(16);
function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */

const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}

const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native = {
  randomUUID
};

function v4(options, buf, offset) {
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }

  options = options || {};
  const rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  return unsafeStringify(rnds);
}

/**
 * Abstract base class for all AI models
 */
class AbstractModel {
    /**
     * Send a message to the AI model and get a response
     * @param prompt The message to send
     * @param options Additional options for the request
     */
    async sendMessage(prompt, options = {}) {
        try {
            let fullResponse = '';
            await this.doSendMessage({
                prompt,
                image: options.image,
                signal: options.signal,
                onEvent: (event) => {
                    if (event.type === 'UPDATE_ANSWER') {
                        fullResponse = event.data.text;
                        options.onProgress?.(fullResponse);
                    }
                }
            });
            return fullResponse;
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            throw new AIModelError(error instanceof Error ? error.message : String(error), ErrorCode.UNKNOWN_ERROR);
        }
    }
    async loadThreadsFromStorage() {
        try {
            const result = await Browser.storage.local.get(AbstractModel.THREADS_STORAGE_KEY);
            return result[AbstractModel.THREADS_STORAGE_KEY] || [];
        }
        catch (error) {
            console.error('Failed to load threads from storage:', error);
            return [];
        }
    }
    async saveThreadsToStorage(threads) {
        try {
            await Browser.storage.local.set({ [AbstractModel.THREADS_STORAGE_KEY]: threads });
        }
        catch (error) {
            console.error('Failed to save threads to storage:', error);
        }
    }
    getCurrentThread() {
        return this.currentThread;
    }
    async loadThread(threadId) {
        const threads = await this.loadThreadsFromStorage();
        const thread = threads.find(t => t.id === threadId);
        if (!thread) {
            throw new Error('Thread not found');
        }
        this.currentThread = thread;
    }
    async saveThread(title) {
        if (!this.currentThread) {
            throw new Error('No active thread to save');
        }
        const threads = await this.loadThreadsFromStorage();
        const existingIndex = threads.findIndex(t => t.id === this.currentThread.id);
        if (existingIndex !== -1) {
            threads[existingIndex] = this.currentThread;
        }
        else {
            threads.push(this.currentThread);
        }
        await this.saveThreadsToStorage(threads);
    }
    async getAllThreads() {
        return this.loadThreadsFromStorage();
    }
    async deleteThread(threadId) {
        const threads = await this.loadThreadsFromStorage();
        await this.saveThreadsToStorage(threads.filter(t => t.id !== threadId));
        if (this.currentThread?.id === threadId) {
            this.initNewThread();
        }
    }
    createMessage(role, content) {
        return {
            id: v4(),
            role,
            content,
            timestamp: Date.now()
        };
    }
}
AbstractModel.THREADS_STORAGE_KEY = 'chat_threads';

/**
 * Convert a ReadableStream to an AsyncIterable
 * @param stream The stream to convert
 */
async function* streamAsyncIterable(stream) {
    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                return;
            }
            yield value;
        }
    }
    finally {
        reader.releaseLock();
    }
}

/**
 * Parse a Server-Sent Events response
 * @param response The response to parse
 * @param onMessage Callback for each message
 */
async function parseSSEResponse(response, onMessage) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine)
                continue;
            if (trimmedLine.startsWith('data: ')) {
                const data = trimmedLine.slice(6);
                onMessage(data);
            }
        }
    }
    // Handle any remaining data
    if (buffer.trim() && buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        onMessage(data);
    }
}

/**
 * Convert a file to a base64 data URL
 * @param file The file to convert
 * @param withPrefix Whether to include the data URL prefix
 */
function file2base64(file, withPrefix = false) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result;
            if (withPrefix) {
                resolve(result);
            }
            else {
                // Remove the data URL prefix (e.g., "data:image/png;base64,")
                resolve(result.split(',')[1]);
            }
        };
        reader.onerror = reject;
    });
}

const DEFAULT_SYSTEM_MESSAGE = "You are ChatGPT, a large language model trained by OpenAI. " +
    "Answer as concisely as possible. " +
    "Current date: {current_date}";
class ChatGPTApiModel extends AbstractModel {
    constructor(config) {
        super();
        this.apiKey = config.apiKey;
        this.model = config.model || 'gpt-3.5-turbo';
        this.systemMessage = config.systemMessage || DEFAULT_SYSTEM_MESSAGE;
    }
    getName() {
        return `ChatGPT API (${this.model})`;
    }
    supportsImageInput() {
        return this.model.includes('gpt-4') && this.model.includes('vision');
    }
    resetConversation() {
        this.conversationContext = undefined;
    }
    buildUserMessage(prompt, imageUrl) {
        if (!imageUrl) {
            return { role: 'user', content: prompt };
        }
        return {
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            ],
        };
    }
    buildMessages(prompt, imageUrl) {
        const currentDate = new Date().toISOString().split('T')[0];
        const systemMessage = this.systemMessage.replace('{current_date}', currentDate);
        return [
            { role: 'system', content: systemMessage },
            ...this.conversationContext.messages.slice(-10),
            this.buildUserMessage(prompt, imageUrl),
        ];
    }
    async doSendMessage(params) {
        if (!this.apiKey) {
            throw new AIModelError('ChatGPT API key is required', ErrorCode.MISSING_API_KEY);
        }
        if (!this.conversationContext) {
            this.conversationContext = { messages: [] };
        }
        let imageUrl;
        if (params.image) {
            if (!this.supportsImageInput()) {
                throw new AIModelError(`The model ${this.model} does not support image input`, ErrorCode.UNKNOWN_ERROR);
            }
            imageUrl = await file2base64(params.image, true);
        }
        const messages = this.buildMessages(params.prompt, imageUrl);
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    stream: true,
                }),
                signal: params.signal,
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new AIModelError(error.error?.message || `HTTP error ${response.status}`, response.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.SERVICE_UNAVAILABLE);
            }
            // Add user message to context only after fetch success
            this.conversationContext.messages.push(this.buildUserMessage(params.prompt, imageUrl));
            let done = false;
            const result = { role: 'assistant', content: '' };
            const finish = () => {
                done = true;
                params.onEvent({ type: 'DONE' });
                const messages = this.conversationContext.messages;
                messages.push(result);
            };
            await parseSSEResponse(response, (message) => {
                if (message === '[DONE]') {
                    finish();
                    return;
                }
                let data;
                try {
                    data = JSON.parse(message);
                }
                catch (err) {
                    console.error(err);
                    return;
                }
                if (data?.choices?.length) {
                    const delta = data.choices[0].delta;
                    if (delta?.content) {
                        if (typeof result.content === 'string') {
                            result.content += delta.content;
                            params.onEvent({
                                type: 'UPDATE_ANSWER',
                                data: { text: result.content },
                            });
                        }
                    }
                }
            });
            if (!done) {
                finish();
            }
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            if (error instanceof DOMException && error.name === 'AbortError') {
                return; // Request was aborted, no need to throw
            }
            throw new AIModelError(error instanceof Error ? error.message : String(error), ErrorCode.NETWORK_ERROR);
        }
    }
    async initNewThread() {
        // Temporary implementation
        this.resetConversation();
    }
}

const suspectProtoRx = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/;
const suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function jsonParseTransform(key, value) {
  if (key === "__proto__" || key === "constructor" && value && typeof value === "object" && "prototype" in value) {
    warnKeyDropped(key);
    return;
  }
  return value;
}
function warnKeyDropped(key) {
  console.warn(`[destr] Dropping "${key}" key to prevent prototype pollution.`);
}
function destr(value, options = {}) {
  if (typeof value !== "string") {
    return value;
  }
  const _value = value.trim();
  if (
    // eslint-disable-next-line unicorn/prefer-at
    value[0] === '"' && value.endsWith('"') && !value.includes("\\")
  ) {
    return _value.slice(1, -1);
  }
  if (_value.length <= 9) {
    const _lval = _value.toLowerCase();
    if (_lval === "true") {
      return true;
    }
    if (_lval === "false") {
      return false;
    }
    if (_lval === "undefined") {
      return void 0;
    }
    if (_lval === "null") {
      return null;
    }
    if (_lval === "nan") {
      return Number.NaN;
    }
    if (_lval === "infinity") {
      return Number.POSITIVE_INFINITY;
    }
    if (_lval === "-infinity") {
      return Number.NEGATIVE_INFINITY;
    }
  }
  if (!JsonSigRx.test(value)) {
    if (options.strict) {
      throw new SyntaxError("[destr] Invalid JSON");
    }
    return value;
  }
  try {
    if (suspectProtoRx.test(value) || suspectConstructorRx.test(value)) {
      if (options.strict) {
        throw new Error("[destr] Possible prototype pollution");
      }
      return JSON.parse(value, jsonParseTransform);
    }
    return JSON.parse(value);
  } catch (error) {
    if (options.strict) {
      throw error;
    }
    return value;
  }
}

const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const PLUS_RE = /\+/g;
const ENC_CARET_RE = /%5e/gi;
const ENC_BACKTICK_RE = /%60/gi;
const ENC_PIPE_RE = /%7c/gi;
const ENC_SPACE_RE = /%20/gi;
function encode(text) {
  return encodeURI("" + text).replace(ENC_PIPE_RE, "|");
}
function encodeQueryValue(input) {
  return encode(typeof input === "string" ? input : JSON.stringify(input)).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CARET_RE, "^").replace(SLASH_RE, "%2F");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function decode(text = "") {
  try {
    return decodeURIComponent("" + text);
  } catch {
    return "" + text;
  }
}
function decodeQueryKey(text) {
  return decode(text.replace(PLUS_RE, " "));
}
function decodeQueryValue(text) {
  return decode(text.replace(PLUS_RE, " "));
}

function parseQuery(parametersString = "") {
  const object = {};
  if (parametersString[0] === "?") {
    parametersString = parametersString.slice(1);
  }
  for (const parameter of parametersString.split("&")) {
    const s = parameter.match(/([^=]+)=?(.*)/) || [];
    if (s.length < 2) {
      continue;
    }
    const key = decodeQueryKey(s[1]);
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = decodeQueryValue(s[2] || "");
    if (object[key] === void 0) {
      object[key] = value;
    } else if (Array.isArray(object[key])) {
      object[key].push(value);
    } else {
      object[key] = [object[key], value];
    }
  }
  return object;
}
function encodeQueryItem(key, value) {
  if (typeof value === "number" || typeof value === "boolean") {
    value = String(value);
  }
  if (!value) {
    return encodeQueryKey(key);
  }
  if (Array.isArray(value)) {
    return value.map((_value) => `${encodeQueryKey(key)}=${encodeQueryValue(_value)}`).join("&");
  }
  return `${encodeQueryKey(key)}=${encodeQueryValue(value)}`;
}
function stringifyQuery(query) {
  return Object.keys(query).filter((k) => query[k] !== void 0).map((k) => encodeQueryItem(k, query[k])).filter(Boolean).join("&");
}

const PROTOCOL_STRICT_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{1,2})/;
const PROTOCOL_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{2})?/;
const PROTOCOL_RELATIVE_REGEX = /^([/\\]\s*){2,}[^/\\]/;
const JOIN_LEADING_SLASH_RE = /^\.?\//;
function hasProtocol(inputString, opts = {}) {
  if (typeof opts === "boolean") {
    opts = { acceptRelative: opts };
  }
  if (opts.strict) {
    return PROTOCOL_STRICT_REGEX.test(inputString);
  }
  return PROTOCOL_REGEX.test(inputString) || (opts.acceptRelative ? PROTOCOL_RELATIVE_REGEX.test(inputString) : false);
}
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/");
  }
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/") ? input : input + "/";
  }
}
function withBase(input, base) {
  if (isEmptyURL(base) || hasProtocol(input)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (input.startsWith(_base)) {
    return input;
  }
  return joinURL(_base, input);
}
function withQuery(input, query) {
  const parsed = parseURL(input);
  const mergedQuery = { ...parseQuery(parsed.search), ...query };
  parsed.search = stringifyQuery(mergedQuery);
  return stringifyParsedURL(parsed);
}
function isEmptyURL(url) {
  return !url || url === "/";
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
function joinURL(base, ...input) {
  let url = base || "";
  for (const segment of input.filter((url2) => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
      url = withTrailingSlash(url) + _segment;
    } else {
      url = segment;
    }
  }
  return url;
}

const protocolRelative = Symbol.for("ufo:protocolRelative");
function parseURL(input = "", defaultProto) {
  const _specialProtoMatch = input.match(
    /^[\s\0]*(blob:|data:|javascript:|vbscript:)(.*)/i
  );
  if (_specialProtoMatch) {
    const [, _proto, _pathname = ""] = _specialProtoMatch;
    return {
      protocol: _proto.toLowerCase(),
      pathname: _pathname,
      href: _proto + _pathname,
      auth: "",
      host: "",
      search: "",
      hash: ""
    };
  }
  if (!hasProtocol(input, { acceptRelative: true })) {
    return parsePath(input);
  }
  const [, protocol = "", auth, hostAndPath = ""] = input.replace(/\\/g, "/").match(/^[\s\0]*([\w+.-]{2,}:)?\/\/([^/@]+@)?(.*)/) || [];
  let [, host = "", path = ""] = hostAndPath.match(/([^#/?]*)(.*)?/) || [];
  if (protocol === "file:") {
    path = path.replace(/\/(?=[A-Za-z]:)/, "");
  }
  const { pathname, search, hash } = parsePath(path);
  return {
    protocol: protocol.toLowerCase(),
    auth: auth ? auth.slice(0, Math.max(0, auth.length - 1)) : "",
    host,
    pathname,
    search,
    hash,
    [protocolRelative]: !protocol
  };
}
function parsePath(input = "") {
  const [pathname = "", search = "", hash = ""] = (input.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return {
    pathname,
    search,
    hash
  };
}
function stringifyParsedURL(parsed) {
  const pathname = parsed.pathname || "";
  const search = parsed.search ? (parsed.search.startsWith("?") ? "" : "?") + parsed.search : "";
  const hash = parsed.hash || "";
  const auth = parsed.auth ? parsed.auth + "@" : "";
  const host = parsed.host || "";
  const proto = parsed.protocol || parsed[protocolRelative] ? (parsed.protocol || "") + "//" : "";
  return proto + auth + host + pathname + search + hash;
}

class FetchError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "FetchError";
    if (opts?.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
}
function createFetchError(ctx) {
  const errorMessage = ctx.error?.message || ctx.error?.toString() || "";
  const method = ctx.request?.method || ctx.options?.method || "GET";
  const url = ctx.request?.url || String(ctx.request) || "/";
  const requestStr = `[${method}] ${JSON.stringify(url)}`;
  const statusStr = ctx.response ? `${ctx.response.status} ${ctx.response.statusText}` : "<no response>";
  const message = `${requestStr}: ${statusStr}${errorMessage ? ` ${errorMessage}` : ""}`;
  const fetchError = new FetchError(
    message,
    ctx.error ? { cause: ctx.error } : void 0
  );
  for (const key of ["request", "options", "response"]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx[key];
      }
    });
  }
  for (const [key, refKey] of [
    ["data", "_data"],
    ["status", "status"],
    ["statusCode", "status"],
    ["statusText", "statusText"],
    ["statusMessage", "statusText"]
  ]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx.response && ctx.response[refKey];
      }
    });
  }
  return fetchError;
}

const payloadMethods = new Set(
  Object.freeze(["PATCH", "POST", "PUT", "DELETE"])
);
function isPayloadMethod(method = "GET") {
  return payloadMethods.has(method.toUpperCase());
}
function isJSONSerializable(value) {
  if (value === void 0) {
    return false;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === null) {
    return true;
  }
  if (t !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value.buffer) {
    return false;
  }
  return value.constructor && value.constructor.name === "Object" || typeof value.toJSON === "function";
}
const textTypes = /* @__PURE__ */ new Set([
  "image/svg",
  "application/xml",
  "application/xhtml",
  "application/html"
]);
const JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function detectResponseType(_contentType = "") {
  if (!_contentType) {
    return "json";
  }
  const contentType = _contentType.split(";").shift() || "";
  if (JSON_RE.test(contentType)) {
    return "json";
  }
  if (textTypes.has(contentType) || contentType.startsWith("text/")) {
    return "text";
  }
  return "blob";
}
function resolveFetchOptions(request, input, defaults, Headers) {
  const headers = mergeHeaders(
    input?.headers ?? request?.headers,
    defaults?.headers,
    Headers
  );
  let query;
  if (defaults?.query || defaults?.params || input?.params || input?.query) {
    query = {
      ...defaults?.params,
      ...defaults?.query,
      ...input?.params,
      ...input?.query
    };
  }
  return {
    ...defaults,
    ...input,
    query,
    params: query,
    headers
  };
}
function mergeHeaders(input, defaults, Headers) {
  if (!defaults) {
    return new Headers(input);
  }
  const headers = new Headers(defaults);
  if (input) {
    for (const [key, value] of Symbol.iterator in input || Array.isArray(input) ? input : new Headers(input)) {
      headers.set(key, value);
    }
  }
  return headers;
}
async function callHooks(context, hooks) {
  if (hooks) {
    if (Array.isArray(hooks)) {
      for (const hook of hooks) {
        await hook(context);
      }
    } else {
      await hooks(context);
    }
  }
}

const retryStatusCodes = /* @__PURE__ */ new Set([
  408,
  // Request Timeout
  409,
  // Conflict
  425,
  // Too Early (Experimental)
  429,
  // Too Many Requests
  500,
  // Internal Server Error
  502,
  // Bad Gateway
  503,
  // Service Unavailable
  504
  // Gateway Timeout
]);
const nullBodyResponses = /* @__PURE__ */ new Set([101, 204, 205, 304]);
function createFetch(globalOptions = {}) {
  const {
    fetch = globalThis.fetch,
    Headers = globalThis.Headers,
    AbortController = globalThis.AbortController
  } = globalOptions;
  async function onError(context) {
    const isAbort = context.error && context.error.name === "AbortError" && !context.options.timeout || false;
    if (context.options.retry !== false && !isAbort) {
      let retries;
      if (typeof context.options.retry === "number") {
        retries = context.options.retry;
      } else {
        retries = isPayloadMethod(context.options.method) ? 0 : 1;
      }
      const responseCode = context.response && context.response.status || 500;
      if (retries > 0 && (Array.isArray(context.options.retryStatusCodes) ? context.options.retryStatusCodes.includes(responseCode) : retryStatusCodes.has(responseCode))) {
        const retryDelay = typeof context.options.retryDelay === "function" ? context.options.retryDelay(context) : context.options.retryDelay || 0;
        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
        return $fetchRaw(context.request, {
          ...context.options,
          retry: retries - 1
        });
      }
    }
    const error = createFetchError(context);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, $fetchRaw);
    }
    throw error;
  }
  const $fetchRaw = async function $fetchRaw2(_request, _options = {}) {
    const context = {
      request: _request,
      options: resolveFetchOptions(
        _request,
        _options,
        globalOptions.defaults,
        Headers
      ),
      response: void 0,
      error: void 0
    };
    if (context.options.method) {
      context.options.method = context.options.method.toUpperCase();
    }
    if (context.options.onRequest) {
      await callHooks(context, context.options.onRequest);
    }
    if (typeof context.request === "string") {
      if (context.options.baseURL) {
        context.request = withBase(context.request, context.options.baseURL);
      }
      if (context.options.query) {
        context.request = withQuery(context.request, context.options.query);
        delete context.options.query;
      }
      if ("query" in context.options) {
        delete context.options.query;
      }
      if ("params" in context.options) {
        delete context.options.params;
      }
    }
    if (context.options.body && isPayloadMethod(context.options.method)) {
      if (isJSONSerializable(context.options.body)) {
        context.options.body = typeof context.options.body === "string" ? context.options.body : JSON.stringify(context.options.body);
        context.options.headers = new Headers(context.options.headers || {});
        if (!context.options.headers.has("content-type")) {
          context.options.headers.set("content-type", "application/json");
        }
        if (!context.options.headers.has("accept")) {
          context.options.headers.set("accept", "application/json");
        }
      } else if (
        // ReadableStream Body
        "pipeTo" in context.options.body && typeof context.options.body.pipeTo === "function" || // Node.js Stream Body
        typeof context.options.body.pipe === "function"
      ) {
        if (!("duplex" in context.options)) {
          context.options.duplex = "half";
        }
      }
    }
    let abortTimeout;
    if (!context.options.signal && context.options.timeout) {
      const controller = new AbortController();
      abortTimeout = setTimeout(() => {
        const error = new Error(
          "[TimeoutError]: The operation was aborted due to timeout"
        );
        error.name = "TimeoutError";
        error.code = 23;
        controller.abort(error);
      }, context.options.timeout);
      context.options.signal = controller.signal;
    }
    try {
      context.response = await fetch(
        context.request,
        context.options
      );
    } catch (error) {
      context.error = error;
      if (context.options.onRequestError) {
        await callHooks(
          context,
          context.options.onRequestError
        );
      }
      return await onError(context);
    } finally {
      if (abortTimeout) {
        clearTimeout(abortTimeout);
      }
    }
    const hasBody = (context.response.body || // https://github.com/unjs/ofetch/issues/324
    // https://github.com/unjs/ofetch/issues/294
    // https://github.com/JakeChampion/fetch/issues/1454
    context.response._bodyInit) && !nullBodyResponses.has(context.response.status) && context.options.method !== "HEAD";
    if (hasBody) {
      const responseType = (context.options.parseResponse ? "json" : context.options.responseType) || detectResponseType(context.response.headers.get("content-type") || "");
      switch (responseType) {
        case "json": {
          const data = await context.response.text();
          const parseFunction = context.options.parseResponse || destr;
          context.response._data = parseFunction(data);
          break;
        }
        case "stream": {
          context.response._data = context.response.body || context.response._bodyInit;
          break;
        }
        default: {
          context.response._data = await context.response[responseType]();
        }
      }
    }
    if (context.options.onResponse) {
      await callHooks(
        context,
        context.options.onResponse
      );
    }
    if (!context.options.ignoreResponseError && context.response.status >= 400 && context.response.status < 600) {
      if (context.options.onResponseError) {
        await callHooks(
          context,
          context.options.onResponseError
        );
      }
      return await onError(context);
    }
    return context.response;
  };
  const $fetch = async function $fetch2(request, options) {
    const r = await $fetchRaw(request, options);
    return r._data;
  };
  $fetch.raw = $fetchRaw;
  $fetch.native = (...args) => fetch(...args);
  $fetch.create = (defaultOptions = {}, customGlobalOptions = {}) => createFetch({
    ...globalOptions,
    ...customGlobalOptions,
    defaults: {
      ...globalOptions.defaults,
      ...customGlobalOptions.defaults,
      ...defaultOptions
    }
  });
  return $fetch;
}

const _globalThis = function() {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw new Error("unable to locate global object");
}();
const fetch$1 = _globalThis.fetch ? (...args) => _globalThis.fetch(...args) : () => Promise.reject(new Error("[ofetch] global.fetch is not supported!"));
const Headers = _globalThis.Headers;
const AbortController = _globalThis.AbortController;
const ofetch = createFetch({ fetch: fetch$1, Headers, AbortController });

// Helper functions
function generateReqId() {
    return Math.floor(Math.random() * 900000) + 100000;
}
function extractFromHTML(variableName, html) {
    const regex = new RegExp(`"${variableName}":"([^"]+)"`);
    const match = regex.exec(html);
    return match?.[1];
}
class BardModel extends AbstractModel {
    constructor() {
        super();
        // Initialize storage and validate threads
        this.initializeStorage().catch(console.error);
    }
    async initializeStorage() {
        // Ensure threads storage exists
        const threads = await this.loadThreadsFromStorage();
        if (!threads.length) {
            await this.saveThreadsToStorage([]);
        }
        await this.validateExistingThreads();
    }
    async validateExistingThreads() {
        const threads = await this.loadThreadsFromStorage();
        let hasChanges = false;
        for (const thread of threads) {
            if (thread.modelName === this.getName() && !this.isValidBardMetadata(thread.metadata)) {
                await this.deleteThread(thread.id);
                hasChanges = true;
            }
        }
        if (hasChanges) {
            await this.saveThreadsToStorage(threads.filter(t => t.modelName !== this.getName() || this.isValidBardMetadata(t.metadata)));
        }
    }
    isValidBardMetadata(metadata) {
        return metadata?.contextIds && metadata?.requestParams;
    }
    getName() {
        return 'Google Bard';
    }
    supportsImageInput() {
        return true;
    }
    async fetchRequestParams() {
        try {
            const response = await ofetch('https://gemini.google.com/', {
                responseType: 'text'
            });
            const atValue = extractFromHTML('SNlM0e', response);
            const blValue = extractFromHTML('cfb2h', response);
            if (!atValue || !blValue) {
                throw new AIModelError('Failed to extract Bard parameters', ErrorCode.UNAUTHORIZED);
            }
            return { atValue, blValue };
        }
        catch (error) {
            throw new AIModelError('Failed to initialize Bard session', ErrorCode.UNAUTHORIZED);
        }
    }
    // KEEP: Response parsing with image support
    parseBardResponse(responseText) {
        try {
            const lines = responseText.split('\n');
            const jsonPart = lines.find(line => line.startsWith('['));
            if (!jsonPart) {
                throw new Error('Invalid response format');
            }
            const data = JSON.parse(jsonPart);
            const payload = JSON.parse(data[0][2]);
            if (!payload) {
                throw new Error('Empty response data');
            }
            const text = payload[4][0][1][0];
            const ids = [
                payload[1][0], // conversationId
                payload[1][1], // responseId
                payload[4][0][0], // choiceId
            ];
            const images = payload[4][0][4] || [];
            let processedText = text;
            for (const image of images) {
                const [media, source, placeholder] = image;
                processedText = processedText.replace(placeholder, `[![${media[4]}](${media[0][0]})](${source[0][0]})`);
            }
            return { text: processedText, ids };
        }
        catch (error) {
            console.error('Error parsing Bard response:', error);
            throw new AIModelError('Failed to parse Bard response', ErrorCode.UNKNOWN_ERROR);
        }
    }
    // KEEP: Image upload functionality
    async uploadImage(image) {
        const headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'push-id': 'feeds/mcudyrk2a4khkz',
            'x-goog-upload-header-content-length': image.size.toString(),
            'x-goog-upload-protocol': 'resumable',
            'x-tenant-id': 'bard-storage',
        };
        const resp = await ofetch.raw('https://content-push.googleapis.com/upload/', {
            method: 'POST',
            headers: {
                ...headers,
                'x-goog-upload-command': 'start',
            },
            body: new URLSearchParams({ [`File name: ${image.name}`]: '' }),
        });
        const uploadUrl = resp.headers.get('x-goog-upload-url');
        if (!uploadUrl) {
            throw new AIModelError('Failed to upload image', ErrorCode.UNKNOWN_ERROR);
        }
        const uploadResult = await ofetch(uploadUrl, {
            method: 'POST',
            headers: {
                ...headers,
                'x-goog-upload-command': 'upload, finalize',
                'x-goog-upload-offset': '0',
            },
            body: image,
        });
        return uploadResult;
    }
    // UPDATE: Main message handling method to use thread system
    // Add this method to properly retrieve the thread from storage before each request
    async ensureThreadLoaded() {
        if (!this.currentThread) {
            // Try to load the most recent thread for this model
            const threads = await this.loadThreadsFromStorage();
            const bardThreads = threads.filter(t => t.modelName === this.getName() && this.isValidBardMetadata(t.metadata));
            if (bardThreads.length > 0) {
                // Sort by most recent and use that thread
                const mostRecentThread = bardThreads.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                this.currentThread = mostRecentThread;
                console.log('Loaded existing thread from storage:', this.currentThread.id);
            }
            else {
                // Create a new thread if none exists
                await this.initNewThread();
            }
        }
    }
    // Update doSendMessage to use the ensureThreadLoaded method
    async doSendMessage(params) {
        try {
            params.onEvent({
                type: 'UPDATE_ANSWER',
                data: { text: '' }
            });
            // Make sure we have a valid thread with the latest data from storage
            await this.ensureThreadLoaded();
            // Now we can safely assert that currentThread exists
            const currentThread = this.getCurrentThreadSafe();
            // Add user message
            const userMessage = this.createMessage('user', params.prompt);
            currentThread.messages.push(userMessage);
            // Get Bard-specific metadata
            const metadata = this.getBardMetadata();
            // IMPORTANT: Log the context IDs to verify they're being retrieved correctly
            console.log('Current context IDs before request:', metadata.contextIds);
            // Handle image upload
            let imageUrl;
            if (params.image) {
                imageUrl = await this.uploadImage(params.image);
            }
            const payload = [
                null,
                JSON.stringify([
                    [params.prompt, 0, null, imageUrl ? [[[imageUrl, 1], params.image.name]] : []],
                    null,
                    metadata.contextIds,
                ]),
            ];
            const resp = await ofetch('https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate', {
                method: 'POST',
                signal: params.signal,
                query: {
                    bl: metadata.requestParams.blValue,
                    _reqid: generateReqId(),
                    rt: 'c',
                },
                body: new URLSearchParams({
                    at: metadata.requestParams.atValue,
                    'f.req': JSON.stringify(payload),
                }),
                parseResponse: (txt) => txt,
            });
            const { text, ids } = this.parseBardResponse(resp);
            // Log the new context IDs
            console.log('New context IDs after response:', ids);
            // Update thread with assistant's response
            const assistantMessage = this.createMessage('assistant', text);
            assistantMessage.metadata = { messageId: ids[0] };
            currentThread.messages.push(assistantMessage);
            // Update thread metadata with new context IDs
            if (currentThread.metadata) {
                currentThread.metadata.contextIds = ids;
            }
            currentThread.updatedAt = Date.now();
            // Save thread to storage - FIXED: Only save once using the proper method
            await this.saveThread();
            // REMOVED: The duplicate thread saving code that was causing duplicates
            // No longer loading all threads and saving again
            // Send events
            params.onEvent({
                type: 'UPDATE_ANSWER',
                data: {
                    text,
                    messageId: ids[0],
                    conversationId: ids[1],
                    messages: currentThread.messages
                }
            });
            params.onEvent({ type: 'DONE' });
        }
        catch (error) {
            params.onEvent({
                type: 'ERROR',
                data: {
                    error: error instanceof AIModelError ? error : new AIModelError(error instanceof Error ? error.message : String(error), ErrorCode.NETWORK_ERROR)
                }
            });
            throw error;
        }
    }
    // OVERRIDE: Thread loading to handle Bard session refresh
    async loadThread(threadId) {
        const threads = await this.loadThreadsFromStorage();
        const thread = threads.find(t => t.id === threadId);
        if (thread && thread.modelName === this.getName()) {
            this.currentThread = thread;
            // Refresh Bard session
            const metadata = this.currentThread.metadata;
            metadata.requestParams = await this.fetchRequestParams();
            await this.saveThread();
            await this.saveThreadsToStorage(threads);
        }
    }
    getBardMetadata() {
        const currentThread = this.getCurrentThreadSafe();
        if (!currentThread.metadata) {
            throw new AIModelError('No thread metadata available', ErrorCode.INVALID_REQUEST);
        }
        const metadata = currentThread.metadata;
        if (!metadata.contextIds || !metadata.requestParams) {
            throw new AIModelError('Invalid thread metadata', ErrorCode.INVALID_REQUEST);
        }
        return metadata;
    }
    getCurrentThreadSafe() {
        if (!this.currentThread) {
            throw new AIModelError('No active thread', ErrorCode.INVALID_REQUEST);
        }
        return this.currentThread;
    }
    async initNewThread() {
        this.currentThread = {
            id: v4(),
            title: 'New Conversation',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            modelName: this.getName(),
            metadata: {
                contextIds: ['', '', ''],
                requestParams: await this.fetchRequestParams()
            }
        };
        // FIXED: Only save once using the proper method
        await this.saveThread();
        // REMOVED: The duplicate thread saving code
    }
    // Add a new method to properly save the thread
    // Changed from protected to public to match parent class
    async saveThread() {
        if (!this.currentThread)
            return;
        // Load all threads
        const threads = await this.loadThreadsFromStorage();
        // Find if this thread already exists
        const existingIndex = threads.findIndex(t => t.id === this.currentThread.id);
        if (existingIndex !== -1) {
            // Update existing thread
            threads[existingIndex] = this.currentThread;
        }
        else {
            // Add new thread
            threads.push(this.currentThread);
        }
        // Save all threads
        await this.saveThreadsToStorage(threads);
    }
}

class ClaudeWebModel extends AbstractModel {
    constructor(config) {
        super();
        this.sessionKey = config.sessionKey;
        this.model = 'claude-2.1';
    }
    getName() {
        return 'Claude (webapp/claude-2)';
    }
    supportsImageInput() {
        return false;
    }
    resetConversation() {
        this.conversationContext = undefined;
    }
    async fetchOrganizationId() {
        try {
            const response = await fetch('https://claude.ai/api/organizations', {
                headers: {
                    Cookie: `sessionKey=${this.sessionKey}`,
                },
            });
            if (!response.ok) {
                throw new AIModelError('Failed to fetch organization ID', ErrorCode.UNAUTHORIZED);
            }
            const data = await response.json();
            if (!data || !data.length) {
                throw new AIModelError('No organizations found', ErrorCode.UNAUTHORIZED);
            }
            return data[0].uuid;
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            throw new AIModelError('Failed to fetch organization ID', ErrorCode.NETWORK_ERROR);
        }
    }
    async createConversation(organizationId) {
        try {
            const response = await fetch('https://claude.ai/api/organizations/' + organizationId + '/chat_conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `sessionKey=${this.sessionKey}`,
                },
                body: JSON.stringify({
                    name: '',
                    uuid: crypto.randomUUID(),
                }),
            });
            if (!response.ok) {
                throw new AIModelError('Failed to create conversation', ErrorCode.SERVICE_UNAVAILABLE);
            }
            const data = await response.json();
            return data.uuid;
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            throw new AIModelError('Failed to create conversation', ErrorCode.NETWORK_ERROR);
        }
    }
    async generateChatTitle(organizationId, conversationId, prompt) {
        try {
            await fetch('https://claude.ai/api/generate_chat_title', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `sessionKey=${this.sessionKey}`,
                },
                body: JSON.stringify({
                    organization_uuid: organizationId,
                    conversation_uuid: conversationId,
                    message_content: prompt,
                    recent_titles: [],
                }),
            });
        }
        catch (error) {
            // Ignore errors when generating chat title
            console.error('Failed to generate chat title:', error);
        }
    }
    async doSendMessage(params) {
        try {
            if (!this.organizationId) {
                this.organizationId = await this.fetchOrganizationId();
            }
            if (!this.conversationContext) {
                const conversationId = await this.createConversation(this.organizationId);
                this.conversationContext = { conversationId };
                this.generateChatTitle(this.organizationId, conversationId, params.prompt).catch(console.error);
            }
            const resp = await fetch('https://claude.ai/api/append_message', {
                method: 'POST',
                signal: params.signal,
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `sessionKey=${this.sessionKey}`,
                },
                body: JSON.stringify({
                    organization_uuid: this.organizationId,
                    conversation_uuid: this.conversationContext.conversationId,
                    text: params.prompt,
                    completion: {
                        prompt: params.prompt,
                        model: this.model,
                    },
                    attachments: [],
                }),
            });
            // Different models are available for different accounts
            if (!resp.ok && resp.status === 403 && this.model === 'claude-2.1') {
                const text = await resp.text();
                if (text.includes('model_not_allowed')) {
                    this.model = 'claude-2.0';
                    return this.doSendMessage(params);
                }
            }
            if (!resp.ok) {
                throw new AIModelError(`HTTP error ${resp.status}`, ErrorCode.SERVICE_UNAVAILABLE);
            }
            let result = '';
            await parseSSEResponse(resp, (message) => {
                try {
                    const payload = JSON.parse(message);
                    if (payload.completion) {
                        result += payload.completion;
                        params.onEvent({
                            type: 'UPDATE_ANSWER',
                            data: { text: result.trimStart() },
                        });
                    }
                    else if (payload.error) {
                        throw new AIModelError(JSON.stringify(payload.error), ErrorCode.SERVICE_UNAVAILABLE);
                    }
                }
                catch (error) {
                    if (error instanceof AIModelError) {
                        throw error;
                    }
                    console.error('Error parsing Claude SSE message:', error);
                }
            });
            params.onEvent({ type: 'DONE' });
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            if (error instanceof DOMException && error.name === 'AbortError') {
                return; // Request was aborted, no need to throw
            }
            throw new AIModelError(error instanceof Error ? error.message : String(error), ErrorCode.NETWORK_ERROR);
        }
    }
    async initNewThread() {
        // Temporary implementation
        this.resetConversation();
    }
}

class BaichuanWebModel extends AbstractModel {
    getName() {
        return '百川大模型';
    }
    supportsImageInput() {
        return false;
    }
    resetConversation() {
        this.conversationContext = undefined;
    }
    generateSessionId() {
        return v4().replace(/-/g, '');
    }
    generateMessageId() {
        return v4().replace(/-/g, '');
    }
    async getUserInfo() {
        try {
            const response = await fetch('https://www.baichuan-ai.com/api/user/info', {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new AIModelError('Failed to get user info', ErrorCode.UNAUTHORIZED);
            }
            const data = await response.json();
            return { id: data.data.id || Math.floor(Math.random() * 1000000) };
        }
        catch (error) {
            // If we can't get the user info, generate a random ID
            return { id: Math.floor(Math.random() * 1000000) };
        }
    }
    async doSendMessage(params) {
        try {
            if (!this.conversationContext) {
                const conversationId = this.generateSessionId();
                const userInfo = await this.getUserInfo();
                this.conversationContext = { conversationId, historyMessages: [], userId: userInfo.id };
            }
            const { conversationId, lastMessageId, historyMessages, userId } = this.conversationContext;
            const message = {
                id: this.generateMessageId(),
                createdAt: Date.now(),
                data: params.prompt,
                from: 0,
            };
            const resp = await fetch('https://www.baichuan-ai.com/api/chat/v1/chat', {
                method: 'POST',
                signal: params.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    assistant: {},
                    assistant_info: {},
                    retry: 3,
                    type: "input",
                    stream: true,
                    request_id: v4(),
                    app_info: { id: 10001, name: 'baichuan_web' },
                    user_info: { id: userId, status: 1 },
                    prompt: {
                        id: message.id,
                        data: message.data,
                        from: message.from,
                        parent_id: lastMessageId || 0,
                        created_at: message.createdAt,
                        attachments: []
                    },
                    session_info: { id: conversationId, name: '新的对话', created_at: Date.now() },
                    parameters: {
                        repetition_penalty: -1,
                        temperature: -1,
                        top_k: -1,
                        top_p: -1,
                        max_new_tokens: -1,
                        do_sample: -1,
                        regenerate: 0,
                        wse: true
                    },
                    history: historyMessages,
                }),
            });
            if (!resp.ok) {
                throw new AIModelError(`HTTP error ${resp.status}`, ErrorCode.SERVICE_UNAVAILABLE);
            }
            const decoder = new TextDecoder();
            let result = '';
            let answerMessageId;
            for await (const uint8Array of streamAsyncIterable(resp.body)) {
                const str = decoder.decode(uint8Array);
                const lines = str.split('\n');
                for (const line of lines) {
                    if (!line) {
                        continue;
                    }
                    try {
                        const data = JSON.parse(line);
                        if (!data.answer) {
                            continue;
                        }
                        answerMessageId = data.answer.id;
                        const text = data.answer.data;
                        if (text) {
                            result += text;
                            params.onEvent({ type: 'UPDATE_ANSWER', data: { text: result } });
                        }
                    }
                    catch (error) {
                        console.error('Error parsing Baichuan stream:', error);
                    }
                }
            }
            this.conversationContext.historyMessages.push(message);
            if (answerMessageId) {
                this.conversationContext.lastMessageId = answerMessageId;
                if (result) {
                    this.conversationContext.historyMessages.push({
                        id: answerMessageId,
                        data: result,
                        createdAt: Date.now(),
                        from: 1,
                    });
                }
            }
            params.onEvent({ type: 'DONE' });
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            if (error instanceof DOMException && error.name === 'AbortError') {
                return; // Request was aborted, no need to throw
            }
            throw new AIModelError(error instanceof Error ? error.message : String(error), ErrorCode.NETWORK_ERROR);
        }
    }
    // Add this method to implement the abstract requirement
    async initNewThread() {
        this.conversationContext = undefined;
    }
}

class OpenRouterModel extends AbstractModel {
    constructor(config) {
        super();
        this.apiKey = config.apiKey;
        this.model = config.model;
    }
    getName() {
        return `OpenRouter/${this.model}`;
    }
    supportsImageInput() {
        return false;
    }
    resetConversation() {
        this.conversationContext = undefined;
    }
    buildMessages(prompt) {
        return [
            ...this.conversationContext.messages.slice(-10),
            { role: 'user', content: prompt }
        ];
    }
    async doSendMessage(params) {
        try {
            if (!this.apiKey) {
                throw new AIModelError('OpenRouter API key is required', ErrorCode.MISSING_API_KEY);
            }
            if (!this.conversationContext) {
                this.conversationContext = { messages: [] };
            }
            const messages = this.buildMessages(params.prompt);
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                signal: params.signal,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'URL', //TODO
                    'X-Title': 'TITLE', //TODO
                },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    stream: true,
                }),
            });
            if (!resp.ok) {
                const error = await resp.json().catch(() => ({}));
                throw new AIModelError(error.error?.message || `HTTP error ${resp.status}`, resp.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.SERVICE_UNAVAILABLE);
            }
            // Add user message to context only after fetch success
            this.conversationContext.messages.push({
                role: 'user',
                content: params.prompt,
            });
            let done = false;
            const result = { role: 'assistant', content: '' };
            const finish = () => {
                done = true;
                params.onEvent({ type: 'DONE' });
                const messages = this.conversationContext.messages;
                messages.push(result);
            };
            await parseSSEResponse(resp, (message) => {
                if (message === '[DONE]') {
                    finish();
                    return;
                }
                let data;
                try {
                    data = JSON.parse(message);
                }
                catch (err) {
                    console.error(err);
                    return;
                }
                if (data?.choices?.length) {
                    const delta = data.choices[0].delta;
                    if (delta?.content) {
                        result.content += delta.content;
                        params.onEvent({
                            type: 'UPDATE_ANSWER',
                            data: { text: result.content },
                        });
                    }
                }
            });
            if (!done) {
                finish();
            }
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            if (error instanceof DOMException && error.name === 'AbortError') {
                return; // Request was aborted, no need to throw
            }
            throw new AIModelError(error instanceof Error ? error.message : String(error), ErrorCode.NETWORK_ERROR);
        }
    }
    async initNewThread() {
        // Temporary implementation
        this.resetConversation();
    }
}

class GeminiApiModel extends AbstractModel {
    constructor(config) {
        super();
        // We'll initialize the SDK in doSendMessage to avoid importing it here
        this.sdk = null;
        this.initializeSDK(config.apiKey);
    }
    async initializeSDK(apiKey) {
        try {
            // Dynamically import the SDK to avoid bundling issues
            const { GoogleGenerativeAI } = await Promise.resolve().then(function () { return index; });
            this.sdk = new GoogleGenerativeAI(apiKey);
        }
        catch (error) {
            console.error('Failed to initialize Gemini SDK:', error);
        }
    }
    getName() {
        return 'Gemini Pro';
    }
    supportsImageInput() {
        return false; // Gemini Pro doesn't support image input in this implementation
    }
    resetConversation() {
        this.conversationContext = undefined;
    }
    async initNewThread() {
        // Temporary implementation
        this.resetConversation();
    }
    async doSendMessage(params) {
        try {
            if (!this.sdk) {
                throw new AIModelError('Gemini API not initialized', ErrorCode.SERVICE_UNAVAILABLE);
            }
            if (!this.conversationContext) {
                const model = this.sdk.getGenerativeModel({ model: 'gemini-pro' });
                const chatSession = model.startChat();
                this.conversationContext = { chatSession };
            }
            const result = await this.conversationContext.chatSession.sendMessageStream(params.prompt);
            let text = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                text += chunkText;
                params.onEvent({ type: 'UPDATE_ANSWER', data: { text } });
            }
            if (!text) {
                params.onEvent({ type: 'UPDATE_ANSWER', data: { text: 'Empty response' } });
            }
            params.onEvent({ type: 'DONE' });
        }
        catch (error) {
            if (error instanceof AIModelError) {
                throw error;
            }
            if (error instanceof DOMException && error.name === 'AbortError') {
                return; // Request was aborted, no need to throw
            }
            throw new AIModelError(error instanceof Error ? error.message : String(error), ErrorCode.NETWORK_ERROR);
        }
    }
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Harm categories that would cause prompts or candidates to be blocked.
 * @public
 */
var HarmCategory;
(function (HarmCategory) {
    HarmCategory["HARM_CATEGORY_UNSPECIFIED"] = "HARM_CATEGORY_UNSPECIFIED";
    HarmCategory["HARM_CATEGORY_HATE_SPEECH"] = "HARM_CATEGORY_HATE_SPEECH";
    HarmCategory["HARM_CATEGORY_SEXUALLY_EXPLICIT"] = "HARM_CATEGORY_SEXUALLY_EXPLICIT";
    HarmCategory["HARM_CATEGORY_HARASSMENT"] = "HARM_CATEGORY_HARASSMENT";
    HarmCategory["HARM_CATEGORY_DANGEROUS_CONTENT"] = "HARM_CATEGORY_DANGEROUS_CONTENT";
})(HarmCategory || (HarmCategory = {}));
/**
 * Threshhold above which a prompt or candidate will be blocked.
 * @public
 */
var HarmBlockThreshold;
(function (HarmBlockThreshold) {
    // Threshold is unspecified.
    HarmBlockThreshold["HARM_BLOCK_THRESHOLD_UNSPECIFIED"] = "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
    // Content with NEGLIGIBLE will be allowed.
    HarmBlockThreshold["BLOCK_LOW_AND_ABOVE"] = "BLOCK_LOW_AND_ABOVE";
    // Content with NEGLIGIBLE and LOW will be allowed.
    HarmBlockThreshold["BLOCK_MEDIUM_AND_ABOVE"] = "BLOCK_MEDIUM_AND_ABOVE";
    // Content with NEGLIGIBLE, LOW, and MEDIUM will be allowed.
    HarmBlockThreshold["BLOCK_ONLY_HIGH"] = "BLOCK_ONLY_HIGH";
    // All content will be allowed.
    HarmBlockThreshold["BLOCK_NONE"] = "BLOCK_NONE";
})(HarmBlockThreshold || (HarmBlockThreshold = {}));
/**
 * Probability that a prompt or candidate matches a harm category.
 * @public
 */
var HarmProbability;
(function (HarmProbability) {
    // Probability is unspecified.
    HarmProbability["HARM_PROBABILITY_UNSPECIFIED"] = "HARM_PROBABILITY_UNSPECIFIED";
    // Content has a negligible chance of being unsafe.
    HarmProbability["NEGLIGIBLE"] = "NEGLIGIBLE";
    // Content has a low chance of being unsafe.
    HarmProbability["LOW"] = "LOW";
    // Content has a medium chance of being unsafe.
    HarmProbability["MEDIUM"] = "MEDIUM";
    // Content has a high chance of being unsafe.
    HarmProbability["HIGH"] = "HIGH";
})(HarmProbability || (HarmProbability = {}));
/**
 * Reason that a prompt was blocked.
 * @public
 */
var BlockReason;
(function (BlockReason) {
    // A blocked reason was not specified.
    BlockReason["BLOCKED_REASON_UNSPECIFIED"] = "BLOCKED_REASON_UNSPECIFIED";
    // Content was blocked by safety settings.
    BlockReason["SAFETY"] = "SAFETY";
    // Content was blocked, but the reason is uncategorized.
    BlockReason["OTHER"] = "OTHER";
})(BlockReason || (BlockReason = {}));
/**
 * Reason that a candidate finished.
 * @public
 */
var FinishReason;
(function (FinishReason) {
    // Default value. This value is unused.
    FinishReason["FINISH_REASON_UNSPECIFIED"] = "FINISH_REASON_UNSPECIFIED";
    // Natural stop point of the model or provided stop sequence.
    FinishReason["STOP"] = "STOP";
    // The maximum number of tokens as specified in the request was reached.
    FinishReason["MAX_TOKENS"] = "MAX_TOKENS";
    // The candidate content was flagged for safety reasons.
    FinishReason["SAFETY"] = "SAFETY";
    // The candidate content was flagged for recitation reasons.
    FinishReason["RECITATION"] = "RECITATION";
    // Unknown reason.
    FinishReason["OTHER"] = "OTHER";
})(FinishReason || (FinishReason = {}));
/**
 * Task type for embedding content.
 * @public
 */
var TaskType;
(function (TaskType) {
    TaskType["TASK_TYPE_UNSPECIFIED"] = "TASK_TYPE_UNSPECIFIED";
    TaskType["RETRIEVAL_QUERY"] = "RETRIEVAL_QUERY";
    TaskType["RETRIEVAL_DOCUMENT"] = "RETRIEVAL_DOCUMENT";
    TaskType["SEMANTIC_SIMILARITY"] = "SEMANTIC_SIMILARITY";
    TaskType["CLASSIFICATION"] = "CLASSIFICATION";
    TaskType["CLUSTERING"] = "CLUSTERING";
})(TaskType || (TaskType = {}));

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class GoogleGenerativeAIError extends Error {
    constructor(message) {
        super(`[GoogleGenerativeAI Error]: ${message}`);
    }
}
class GoogleGenerativeAIResponseError extends GoogleGenerativeAIError {
    constructor(message, response) {
        super(message);
        this.response = response;
    }
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const BASE_URL = "https://generativelanguage.googleapis.com";
const API_VERSION = "v1";
/**
 * We can't `require` package.json if this runs on web. We will use rollup to
 * swap in the version number here at build time.
 */
const PACKAGE_VERSION = "0.1.3";
const PACKAGE_LOG_HEADER = "genai-js";
var Task;
(function (Task) {
    Task["GENERATE_CONTENT"] = "generateContent";
    Task["STREAM_GENERATE_CONTENT"] = "streamGenerateContent";
    Task["COUNT_TOKENS"] = "countTokens";
    Task["EMBED_CONTENT"] = "embedContent";
    Task["BATCH_EMBED_CONTENTS"] = "batchEmbedContents";
})(Task || (Task = {}));
class RequestUrl {
    constructor(model, task, apiKey, stream) {
        this.model = model;
        this.task = task;
        this.apiKey = apiKey;
        this.stream = stream;
    }
    toString() {
        let url = `${BASE_URL}/${API_VERSION}/models/${this.model}:${this.task}`;
        if (this.stream) {
            url += "?alt=sse";
        }
        return url;
    }
}
/**
 * Simple, but may become more complex if we add more versions to log.
 */
function getClientHeaders() {
    return `${PACKAGE_LOG_HEADER}/${PACKAGE_VERSION}`;
}
async function makeRequest(url, body) {
    let response;
    try {
        response = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-client": getClientHeaders(),
                "x-goog-api-key": url.apiKey,
            },
            body,
        });
        if (!response.ok) {
            let message = "";
            try {
                const json = await response.json();
                message = json.error.message;
                if (json.error.details) {
                    message += ` ${JSON.stringify(json.error.details)}`;
                }
            }
            catch (e) {
                // ignored
            }
            throw new Error(`[${response.status} ${response.statusText}] ${message}`);
        }
    }
    catch (e) {
        const err = new GoogleGenerativeAIError(`Error fetching from ${url.toString()}: ${e.message}`);
        err.stack = e.stack;
        throw err;
    }
    return response;
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Adds convenience helper methods to a response object, including stream
 * chunks (as long as each chunk is a complete GenerateContentResponse JSON).
 */
function addHelpers(response) {
    response.text = () => {
        if (response.candidates && response.candidates.length > 0) {
            if (response.candidates.length > 1) {
                console.warn(`This response had ${response.candidates.length} ` +
                    `candidates. Returning text from the first candidate only. ` +
                    `Access response.candidates directly to use the other candidates.`);
            }
            if (hadBadFinishReason(response.candidates[0])) {
                throw new GoogleGenerativeAIResponseError(`${formatBlockErrorMessage(response)}`, response);
            }
            return getText(response);
        }
        else if (response.promptFeedback) {
            throw new GoogleGenerativeAIResponseError(`Text not available. ${formatBlockErrorMessage(response)}`, response);
        }
        return "";
    };
    return response;
}
/**
 * Returns text of first candidate.
 */
function getText(response) {
    var _a, _b, _c, _d;
    if ((_d = (_c = (_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0].content) === null || _b === void 0 ? void 0 : _b.parts) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.text) {
        return response.candidates[0].content.parts[0].text;
    }
    else {
        return "";
    }
}
const badFinishReasons = [FinishReason.RECITATION, FinishReason.SAFETY];
function hadBadFinishReason(candidate) {
    return (!!candidate.finishReason &&
        badFinishReasons.includes(candidate.finishReason));
}
function formatBlockErrorMessage(response) {
    var _a, _b, _c;
    let message = "";
    if ((!response.candidates || response.candidates.length === 0) &&
        response.promptFeedback) {
        message += "Response was blocked";
        if ((_a = response.promptFeedback) === null || _a === void 0 ? void 0 : _a.blockReason) {
            message += ` due to ${response.promptFeedback.blockReason}`;
        }
        if ((_b = response.promptFeedback) === null || _b === void 0 ? void 0 : _b.blockReasonMessage) {
            message += `: ${response.promptFeedback.blockReasonMessage}`;
        }
    }
    else if ((_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0]) {
        const firstCandidate = response.candidates[0];
        if (hadBadFinishReason(firstCandidate)) {
            message += `Candidate was blocked due to ${firstCandidate.finishReason}`;
            if (firstCandidate.finishMessage) {
                message += `: ${firstCandidate.finishMessage}`;
            }
        }
    }
    return message;
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const responseLineRE = /^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;
/**
 * Process a response.body stream from the backend and return an
 * iterator that provides one complete GenerateContentResponse at a time
 * and a promise that resolves with a single aggregated
 * GenerateContentResponse.
 *
 * @param response - Response from a fetch call
 */
function processStream(response) {
    const inputStream = response.body.pipeThrough(new TextDecoderStream("utf8", { fatal: true }));
    const responseStream = getResponseStream(inputStream);
    const [stream1, stream2] = responseStream.tee();
    return {
        stream: generateResponseSequence(stream1),
        response: getResponsePromise(stream2),
    };
}
async function getResponsePromise(stream) {
    const allResponses = [];
    const reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            return addHelpers(aggregateResponses(allResponses));
        }
        allResponses.push(value);
    }
}
function generateResponseSequence(stream) {
    return __asyncGenerator(this, arguments, function* generateResponseSequence_1() {
        const reader = stream.getReader();
        while (true) {
            const { value, done } = yield __await(reader.read());
            if (done) {
                break;
            }
            yield yield __await(addHelpers(value));
        }
    });
}
/**
 * Reads a raw stream from the fetch response and join incomplete
 * chunks, returning a new stream that provides a single complete
 * GenerateContentResponse in each iteration.
 */
function getResponseStream(inputStream) {
    const reader = inputStream.getReader();
    const stream = new ReadableStream({
        start(controller) {
            let currentText = "";
            return pump();
            function pump() {
                return reader.read().then(({ value, done }) => {
                    if (done) {
                        if (currentText.trim()) {
                            controller.error(new GoogleGenerativeAIError("Failed to parse stream"));
                            return;
                        }
                        controller.close();
                        return;
                    }
                    currentText += value;
                    let match = currentText.match(responseLineRE);
                    let parsedResponse;
                    while (match) {
                        try {
                            parsedResponse = JSON.parse(match[1]);
                        }
                        catch (e) {
                            controller.error(new GoogleGenerativeAIError(`Error parsing JSON response: "${match[1]}"`));
                            return;
                        }
                        controller.enqueue(parsedResponse);
                        currentText = currentText.substring(match[0].length);
                        match = currentText.match(responseLineRE);
                    }
                    return pump();
                });
            }
        },
    });
    return stream;
}
/**
 * Aggregates an array of `GenerateContentResponse`s into a single
 * GenerateContentResponse.
 */
function aggregateResponses(responses) {
    const lastResponse = responses[responses.length - 1];
    const aggregatedResponse = {
        promptFeedback: lastResponse === null || lastResponse === void 0 ? void 0 : lastResponse.promptFeedback,
    };
    for (const response of responses) {
        if (response.candidates) {
            for (const candidate of response.candidates) {
                const i = candidate.index;
                if (!aggregatedResponse.candidates) {
                    aggregatedResponse.candidates = [];
                }
                if (!aggregatedResponse.candidates[i]) {
                    aggregatedResponse.candidates[i] = {
                        index: candidate.index,
                    };
                }
                // Keep overwriting, the last one will be final
                aggregatedResponse.candidates[i].citationMetadata =
                    candidate.citationMetadata;
                aggregatedResponse.candidates[i].finishReason = candidate.finishReason;
                aggregatedResponse.candidates[i].finishMessage =
                    candidate.finishMessage;
                aggregatedResponse.candidates[i].safetyRatings =
                    candidate.safetyRatings;
                /**
                 * Candidates should always have content and parts, but this handles
                 * possible malformed responses.
                 */
                if (candidate.content && candidate.content.parts) {
                    if (!aggregatedResponse.candidates[i].content) {
                        aggregatedResponse.candidates[i].content = {
                            role: candidate.content.role || "user",
                            parts: [{ text: "" }],
                        };
                    }
                    for (const part of candidate.content.parts) {
                        if (part.text) {
                            aggregatedResponse.candidates[i].content.parts[0].text +=
                                part.text;
                        }
                    }
                }
            }
        }
    }
    return aggregatedResponse;
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function generateContentStream(apiKey, model, params) {
    const url = new RequestUrl(model, Task.STREAM_GENERATE_CONTENT, apiKey, 
    /* stream */ true);
    const response = await makeRequest(url, JSON.stringify(params));
    return processStream(response);
}
async function generateContent(apiKey, model, params) {
    const url = new RequestUrl(model, Task.GENERATE_CONTENT, apiKey, 
    /* stream */ false);
    const response = await makeRequest(url, JSON.stringify(params));
    const responseJson = await response.json();
    const enhancedResponse = addHelpers(responseJson);
    return {
        response: enhancedResponse,
    };
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function formatNewContent(request, role) {
    let newParts = [];
    if (typeof request === "string") {
        newParts = [{ text: request }];
    }
    else {
        for (const partOrString of request) {
            if (typeof partOrString === "string") {
                newParts.push({ text: partOrString });
            }
            else {
                newParts.push(partOrString);
            }
        }
    }
    return { role, parts: newParts };
}
function formatGenerateContentInput(params) {
    if (params.contents) {
        return params;
    }
    else {
        const content = formatNewContent(params, "user");
        return { contents: [content] };
    }
}
function formatEmbedContentInput(params) {
    if (typeof params === "string" || Array.isArray(params)) {
        const content = formatNewContent(params, "user");
        return { content };
    }
    return params;
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Do not log a message for this error.
 */
const SILENT_ERROR = "SILENT_ERROR";
/**
 * ChatSession class that enables sending chat messages and stores
 * history of sent and received messages so far.
 *
 * @public
 */
class ChatSession {
    constructor(apiKey, model, params) {
        this.model = model;
        this.params = params;
        this._history = [];
        this._sendPromise = Promise.resolve();
        this._apiKey = apiKey;
        if (params === null || params === void 0 ? void 0 : params.history) {
            this._history = params.history.map((content) => {
                if (!content.role) {
                    throw new Error("Missing role for history item: " + JSON.stringify(content));
                }
                return formatNewContent(content.parts, content.role);
            });
        }
    }
    /**
     * Gets the chat history so far. Blocked prompts are not added to history.
     * Blocked candidates are not added to history, nor are the prompts that
     * generated them.
     */
    async getHistory() {
        await this._sendPromise;
        return this._history;
    }
    /**
     * Sends a chat message and receives a non-streaming
     * {@link GenerateContentResult}
     */
    async sendMessage(request) {
        var _a, _b;
        await this._sendPromise;
        const newContent = formatNewContent(request, "user");
        const generateContentRequest = {
            safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
            generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
            contents: [...this._history, newContent],
        };
        let finalResult;
        // Add onto the chain.
        this._sendPromise = this._sendPromise
            .then(() => generateContent(this._apiKey, this.model, generateContentRequest))
            .then((result) => {
            var _a;
            if (result.response.candidates &&
                result.response.candidates.length > 0) {
                this._history.push(newContent);
                const responseContent = Object.assign({ parts: [], 
                    // Response seems to come back without a role set.
                    role: "model" }, (_a = result.response.candidates) === null || _a === void 0 ? void 0 : _a[0].content);
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(result.response);
                if (blockErrorMessage) {
                    console.warn(`sendMessage() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
            finalResult = result;
        });
        await this._sendPromise;
        return finalResult;
    }
    /**
     * Sends a chat message and receives the response as a
     * {@link GenerateContentStreamResult} containing an iterable stream
     * and a response promise.
     */
    async sendMessageStream(request) {
        var _a, _b;
        await this._sendPromise;
        const newContent = formatNewContent(request, "user");
        const generateContentRequest = {
            safetySettings: (_a = this.params) === null || _a === void 0 ? void 0 : _a.safetySettings,
            generationConfig: (_b = this.params) === null || _b === void 0 ? void 0 : _b.generationConfig,
            contents: [...this._history, newContent],
        };
        const streamPromise = generateContentStream(this._apiKey, this.model, generateContentRequest);
        // Add onto the chain.
        this._sendPromise = this._sendPromise
            .then(() => streamPromise)
            // This must be handled to avoid unhandled rejection, but jump
            // to the final catch block with a label to not log this error.
            .catch((_ignored) => {
            throw new Error(SILENT_ERROR);
        })
            .then((streamResult) => streamResult.response)
            .then((response) => {
            if (response.candidates && response.candidates.length > 0) {
                this._history.push(newContent);
                const responseContent = Object.assign({}, response.candidates[0].content);
                // Response seems to come back without a role set.
                if (!responseContent.role) {
                    responseContent.role = "model";
                }
                this._history.push(responseContent);
            }
            else {
                const blockErrorMessage = formatBlockErrorMessage(response);
                if (blockErrorMessage) {
                    console.warn(`sendMessageStream() was unsuccessful. ${blockErrorMessage}. Inspect response object for details.`);
                }
            }
        })
            .catch((e) => {
            // Errors in streamPromise are already catchable by the user as
            // streamPromise is returned.
            // Avoid duplicating the error message in logs.
            if (e.message !== SILENT_ERROR) {
                // Users do not have access to _sendPromise to catch errors
                // downstream from streamPromise, so they should not throw.
                console.error(e);
            }
        });
        return streamPromise;
    }
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function countTokens(apiKey, model, params) {
    const url = new RequestUrl(model, Task.COUNT_TOKENS, apiKey, false);
    const response = await makeRequest(url, JSON.stringify(Object.assign(Object.assign({}, params), { model })));
    return response.json();
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
async function embedContent(apiKey, model, params) {
    const url = new RequestUrl(model, Task.EMBED_CONTENT, apiKey, false);
    const response = await makeRequest(url, JSON.stringify(params));
    return response.json();
}
async function batchEmbedContents(apiKey, model, params) {
    const url = new RequestUrl(model, Task.BATCH_EMBED_CONTENTS, apiKey, false);
    const requestsWithModel = params.requests.map((request) => {
        return Object.assign(Object.assign({}, request), { model: `models/${model}` });
    });
    const response = await makeRequest(url, JSON.stringify({ requests: requestsWithModel }));
    return response.json();
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Class for generative model APIs.
 * @public
 */
class GenerativeModel {
    constructor(apiKey, modelParams) {
        var _a;
        this.apiKey = apiKey;
        if (modelParams.model.startsWith("models/")) {
            this.model = (_a = modelParams.model.split("models/")) === null || _a === void 0 ? void 0 : _a[1];
        }
        else {
            this.model = modelParams.model;
        }
        this.generationConfig = modelParams.generationConfig || {};
        this.safetySettings = modelParams.safetySettings || [];
    }
    /**
     * Makes a single non-streaming call to the model
     * and returns an object containing a single {@link GenerateContentResponse}.
     */
    async generateContent(request) {
        const formattedParams = formatGenerateContentInput(request);
        return generateContent(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings }, formattedParams));
    }
    /**
     * Makes a single streaming call to the model
     * and returns an object containing an iterable stream that iterates
     * over all chunks in the streaming response as well as
     * a promise that returns the final aggregated response.
     */
    async generateContentStream(request) {
        const formattedParams = formatGenerateContentInput(request);
        return generateContentStream(this.apiKey, this.model, Object.assign({ generationConfig: this.generationConfig, safetySettings: this.safetySettings }, formattedParams));
    }
    /**
     * Gets a new {@link ChatSession} instance which can be used for
     * multi-turn chats.
     */
    startChat(startChatParams) {
        return new ChatSession(this.apiKey, this.model, startChatParams);
    }
    /**
     * Counts the tokens in the provided request.
     */
    async countTokens(request) {
        const formattedParams = formatGenerateContentInput(request);
        return countTokens(this.apiKey, this.model, formattedParams);
    }
    /**
     * Embeds the provided content.
     */
    async embedContent(request) {
        const formattedParams = formatEmbedContentInput(request);
        return embedContent(this.apiKey, this.model, formattedParams);
    }
    /**
     * Embeds an array of {@link EmbedContentRequest}s.
     */
    async batchEmbedContents(batchEmbedContentRequest) {
        return batchEmbedContents(this.apiKey, this.model, batchEmbedContentRequest);
    }
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Top-level class for this SDK
 * @public
 */
class GoogleGenerativeAI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Gets a {@link GenerativeModel} instance for the provided model name.
     */
    getGenerativeModel(modelParams) {
        if (!modelParams.model) {
            throw new GoogleGenerativeAIError(`Must provide a model name. ` +
                `Example: genai.getGenerativeModel({ model: 'my-model-name' })`);
        }
        return new GenerativeModel(this.apiKey, modelParams);
    }
}

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    get BlockReason () { return BlockReason; },
    ChatSession: ChatSession,
    get FinishReason () { return FinishReason; },
    GenerativeModel: GenerativeModel,
    GoogleGenerativeAI: GoogleGenerativeAI,
    get HarmBlockThreshold () { return HarmBlockThreshold; },
    get HarmCategory () { return HarmCategory; },
    get HarmProbability () { return HarmProbability; },
    get TaskType () { return TaskType; }
});

export { AIModelError, AbstractModel, BaichuanWebModel, BardModel, ChatGPTApiModel, ClaudeWebModel, ErrorCode, GeminiApiModel, OpenRouterModel, file2base64, parseSSEResponse, streamAsyncIterable };
//# sourceMappingURL=ai-models-bridge.esm.js.map
