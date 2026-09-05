(function () {
  var originalFetch = window.fetch.bind(window);
  var chunkedFiles = {
    "Build/New folder.data": 20,
    "Build/New folder.wasm": 2
  };

  function getFilePath(url) {
    var pathname = new URL(url, document.baseURI).pathname;
    var buildPath = pathname.indexOf("/Build/");
    return decodeURIComponent(buildPath >= 0 ? pathname.substring(buildPath + 1) : pathname.replace(/^\//, ""));
  }

  function getChunkUrl(url, index) {
    var chunkUrl = new URL(url, document.baseURI);
    chunkUrl.pathname += ".part-" + String(index).padStart(3, "0");
    return chunkUrl.href;
  }

  function fetchChunked(url, options, partCount) {
    var parts = [];
    var totalLength = 0;

    function loadPart(index) {
      if (index === partCount) {
        var headers = new Headers({
          "Content-Length": String(totalLength),
          "Content-Type": getFilePath(url).endsWith(".wasm") ? "application/wasm" : "application/octet-stream"
        });
        var stream = new ReadableStream({
          start: function (controller) {
            parts.forEach(function (part) {
              controller.enqueue(part);
            });
            controller.close();
          }
        });
        return Promise.resolve(new Response(stream, { status: 200, headers: headers }));
      }

      return originalFetch(getChunkUrl(url, index), options).then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load chunk " + (index + 1) + " of " + url);
        }
        return response.arrayBuffer();
      }).then(function (part) {
        totalLength += part.byteLength;
        parts.push(new Uint8Array(part));
        return loadPart(index + 1);
      });
    }

    return loadPart(0);
  }

  window.fetch = function (input, options) {
    var url = typeof input === "string" ? input : input.url;
    var partCount = chunkedFiles[getFilePath(url)];
    return partCount ? fetchChunked(url, options, partCount) : originalFetch(input, options);
  };
})();