((document, window) => {
    const okeRenderedHandler = function(e) {
        if (e.detail.widget === 'reviews-widget') {
         setupCollectionControls();
       }
    }
  
    document.addEventListener('oke-rendered', okeRenderedHandler);
  
    if (!String.prototype.startsWith) {
        Object.defineProperty(String.prototype, 'startsWith', {
            value: function(search, rawPos) {
                var pos = rawPos > 0 ? rawPos|0 : 0;
                return this.substring(pos, pos + search.length) === search;
            }
        });
    }
  
    function setupCollectionControls() {
        const snippetEl = document.querySelector('#orc-widget-snippet');
        const controlEl = document.querySelector('#orc-collection-control');
        const collectionRadioElements = Array.prototype.slice.call(document.querySelectorAll('.js-orc-collectionRadio'));
        controlEl.style.display = 'block';
        collectionRadioElements.forEach(function (radioElement) {
            radioElement.addEventListener('change', function () {
            if (radioElement.value) {
              if(radioElement.value.toLowerCase().startsWith('shopify-')) {
                snippetEl.removeAttribute('data-oke-reviews-group-id');
                window.okeWidgetApi.setProduct(snippetEl, radioElement.value);
              }
              else {
                snippetEl.removeAttribute('data-oke-reviews-product-id');
                window.okeWidgetApi.setGroup(snippetEl, radioElement.value);
              }
            } else {
              snippetEl.removeAttribute('data-oke-reviews-group-id');
              snippetEl.removeAttribute('data-oke-reviews-product-id');
              snippetEl.innerHTML = '';
              window.okeWidgetApi.initWidget(snippetEl, true);
            }

            collectionRadioElements.forEach(function (element) {
                element.classList.remove('orc-collectionControls-item-input--checked');
            });
            radioElement.classList.add('orc-collectionControls-item-input--checked');
          });
        });
  
      document.removeEventListener('oke-rendered', okeRenderedHandler);
    }
  })(document, window);