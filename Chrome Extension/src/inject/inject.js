chrome.extension.sendMessage({}, function(response) {
  var readyStateCheckInterval = setInterval(function() {
    if (document.readyState === 'complete') {
      clearInterval(readyStateCheckInterval);

      // Specific location which allows the iframe embedded to be visible
      function getEmbedLocation() {
        return document.getElementsByClassName('punch-full-screen-element')[0];
      }

      // Extract slide number from the presentation
      function getSlideNumber() {
        var labelElement =
            getSlideIframe().contentWindow.document.getElementsByClassName(
                'punch-viewer-svgpage-a11yelement')[0];
        if (!labelElement) return -1;
        var label = labelElement.getAttribute('aria-label');
        return parseInt(label.match(/Slide (\d*)/)[1]);
      }

      // Get the slide iframe
      function getSlideIframe() {
        return document.getElementsByClassName('punch-present-iframe')[0];
      }

      // Get the slide dimensions in svg values
      function getSlideSvgViewDimensions() {
        var svgContainer =
            getSlideIframe().contentWindow.document.getElementsByClassName(
                'punch-viewer-svgpage-svgcontainer')[0];
        var svg = svgContainer.children[0];
        var viewBox = svg.getAttribute('viewBox').split(' ');

        return {
          slideW: parseFloat(viewBox[2]), slideH: parseFloat(viewBox[3])
        }
      }

      // Extract position and size of embedded image in SVG
      // Needed for identifying exact location to embed the iframe
      function extractPositionFromPath(path) {
        var svgLinkPath = path.getAttribute('d');
        var pathRegexExp =
            /M ([\S]*) ([\S]*) L ([\S]*) ([\S]*) ([\S]*) ([\S]*) ([\S]*) ([\S]*) Z/;
        var matches = svgLinkPath.match(pathRegexExp);
        var x1 = parseFloat(matches[1]);
        var y1 = parseFloat(matches[2]);
        var x2 = parseFloat(matches[3]);
        var y3 = parseFloat(matches[6]);
        var widthInSvg = x2 - x1;
        var heightInSvg = y3 - y1;
        return {
          svgX: x1, svgY: y1, svgW: widthInSvg, svgH: heightInSvg
        }
      }

      // Get slide dimensions and offsets in pixels
      function getSlideDimensions() {
        var slideDiv =
            getSlideIframe().contentWindow.document.getElementsByClassName(
                'punch-viewer-content')[0];
        var metadata = {
          xOffsetPx: parseFloat(slideDiv.style.left),
          yOffsetPx: parseFloat(slideDiv.style.top),
          slideWidthPx: parseFloat(slideDiv.style.width),
          slideHeightPx: parseFloat(slideDiv.style.height),
        };
        return metadata;
      }

      // Create circuitverse iframe from anchor tag
      // Calculates exact position and places the iframe
      function createEmbedIframe(anchorTag) {
        var url =
            anchorTag.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        var {svgX, svgY, svgW, svgH} =
            extractPositionFromPath(anchorTag.children[0]);
        var {slideW, slideH} = getSlideSvgViewDimensions();
        var {xOffsetPx, yOffsetPx, slideWidthPx, slideHeightPx} =
            getSlideDimensions();

        var svg2px = slideWidthPx / slideW;

        var absoluteXoffSetPx = xOffsetPx + svgX * svg2px;
        var absoluteYoffSetPx = yOffsetPx + svgY * svg2px;
        var widthPx = svgW * svg2px;
        var heightPx = svgH * svg2px;
        absoluteXoffSetPx = Math.round(absoluteXoffSetPx);
        absoluteYoffSetPx = Math.round(absoluteYoffSetPx);
        widthPx = Math.round(widthPx);
        heightPx = Math.round(heightPx);

        var ifrm = document.createElement('iframe');
        ifrm.classList.add('circuitverse-iframe');  // assign a class
        ifrm.setAttribute('style', `position:fixed;z-index:100;
			width:${widthPx}px;
			height:${heightPx}px;
			top:${absoluteYoffSetPx}px;
			left:${absoluteXoffSetPx}px`);
        // assign url
        ifrm.setAttribute('src', url);

        return ifrm;
      }

      // Embeds iframe given link
      function embed(anchorTag) {
        var iframe = createEmbedIframe(anchorTag);
        var url =
            anchorTag.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        var location = getEmbedLocation();
        if (location == undefined) {
          return;
        }
        location.appendChild(iframe);  // to place at end of document

        iframe_embedded = true;
        url_embedded = url;
      }

      // Removes all embedded iframes
      function removeEmbed() {
        var iframes = document.getElementsByClassName('circuitverse-iframe');
        while (iframes[0]) {
          iframes[0].parentNode.removeChild(iframes[0]);
        }
      }

      // Keeps track of current frame

      var slideNumber = -1;

      // Setting slideNumber = -1 will reset everything
      function reset() {
        slideNumber = -1;
      }

      // Driver logic
      function main() {
        var iframeDocument = getSlideIframe();

        if (!iframeDocument) {
          slideNumber = -1;
          removeEmbed();
          return;
        }

        // Bring slide into focus - necessary for slide transitions to work!
        if (slideNumber != -1) {
          iframeDocument.contentWindow.document.body.focus();
        }

        if (slideNumber == getSlideNumber()) return;

        // New Slide
        removeEmbed();  // remove previous iframes
        slideNumber = getSlideNumber();

        var anchorTags =
            iframeDocument.contentWindow.document.getElementsByTagName('a');

        var prevUrl = undefined;
        for (var i = 0; i < anchorTags.length; i++) {
          var url = anchorTags[i].getAttributeNS(
              'http://www.w3.org/1999/xlink', 'href');

          // Google Slides has 2 anchor tags for every link for some reason;
          // Hence ensuring no duplicate embeds!
          if (url != prevUrl &&
              url.includes('circuitverse.org/simulator/embed')) {
            prevUrl = url
            embed(anchorTags[i]);
          }
        }
      }

      // Call driver logic repeatedly
      setInterval(main, 300);

      // Force reset after 3 seconds - needed for window resizing
      // Also needed if first slide has circuit
      window.addEventListener('resize', () => {
        setTimeout(reset, 3000);
      });
    }
  }, 10);
});
