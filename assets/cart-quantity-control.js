document.addEventListener('DOMContentLoaded', function() {
  
  // Initialize cart state from localStorage
  let cartItems = JSON.parse(localStorage.getItem('cartItems') || '{}');
  
  // Update all product cards on page load
  updateAllProductCards();
  
  // Handle variant selection
  document.querySelectorAll('.fc_variant_item').forEach(item => {
    item.addEventListener('click', function() {
      const card = this.closest('.product-card-primary');
      const variantId = this.getAttribute('data-id');
      const price = this.getAttribute('data-price');
      const comparePrice = this.getAttribute('data-compare');
      const unitPrice = this.getAttribute('data-unit');
      const inventory = this.getAttribute('data-inventory');
      const image = this.getAttribute('data-image');
      
      // Update active state
      card.querySelectorAll('.fc_variant_item').forEach(v => v.classList.remove('active'));
      this.classList.add('active');
      
      // Update hidden input
      card.querySelector('input[name="id"]').value = variantId;
      
      // Update price display
      const priceContainer = card.querySelector('.fc_price_weight');
      if (comparePrice && comparePrice !== price) {
        priceContainer.querySelector('p').innerHTML = `
          <strike id="compare_price">${comparePrice}</strike>
          <span class="selling_price">${price}</span>
        `;
      } else {
        priceContainer.querySelector('p').innerHTML = `
          <span class="selling_price">${price}</span>
        `;
      }
      
      // Update unit price only when Shopify provides real unit measurement data.
      const unitPriceEl = card.querySelector('.fc_weight');
      if (unitPriceEl) {
        if (unitPrice) {
          unitPriceEl.textContent = unitPrice;
          unitPriceEl.style.display = '';
        } else {
          unitPriceEl.textContent = '';
          unitPriceEl.style.display = 'none';
        }
      }
      
      // Update inventory text
      const inventoryQty = parseInt(inventory, 10) || 0;
      const inventoryTemplate = window.themeStrings?.inventoryStatus || 'Only __COUNT__ left';
      const inventoryText = inventoryQty <= 0
        ? (window.themeStrings?.outOfStock || 'Out of stock')
        : inventoryQty < 100
          ? inventoryTemplate.replace('__COUNT__', inventoryQty)
          : (window.themeStrings?.inStock || 'In stock');
      card.querySelector('.fc_trust_text p').textContent = inventoryText;
      card.querySelector('.fc_trust_text p').classList.toggle('low-stock', inventoryQty > 0 && inventoryQty < 100);
      
      // Update image if available
      if (image && image !== 'null') {
        card.querySelector('.primary-img').src = image;
      }
      
      // Update cart button state for new variant
      updateCartButton(card, variantId);
    });
  });
  
  // Handle form submission (Add to Cart button click)
  document.querySelectorAll('form[action="/cart/add"]:not(.product-card-add-form)').forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const card = this.closest('.product-card-primary');
      const variantId = this.querySelector('input[name="id"]').value;
      const addButton = this.querySelector('.add-to-cart');

      if (!addButton) return;
      
      // Only add if button shows "Add to Cart" text
      if (!addButton.classList.contains('has-quantity')) {
        addToCart(variantId, 1);
        updateCartButton(card, variantId);
      }
    });
  });
  
  // Handle quantity increase
  document.querySelectorAll('.add_product').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const form = this.closest('form');
      const card = this.closest('.product-card-primary');
      const variantId = form.querySelector('input[name="id"]').value;
      
      // Increase quantity
      addToCart(variantId, 1);
      updateCartButton(card, variantId);
    });
  });
  
  // Handle quantity decrease
  document.querySelectorAll('.remove_product').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const form = this.closest('form');
      const card = this.closest('.product-card-primary');
      const variantId = form.querySelector('input[name="id"]').value;
      
      // Decrease quantity
      removeFromCart(variantId, 1);
      updateCartButton(card, variantId);
    });
  });
  
  // Add to cart function
  function addToCart(variantId, quantity) {
    if (!cartItems[variantId]) {
      cartItems[variantId] = 0;
    }
    cartItems[variantId] += quantity;
    
    // Save to localStorage
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
    
    // Make actual cart API call to Shopify
    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: variantId,
        quantity: quantity
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Added to cart:', data);
      // Trigger cart update event if you have a cart drawer
      document.dispatchEvent(new CustomEvent('cart:updated'));
    })
    .catch(error => console.error('Error adding to cart:', error));
  }
  
  // Remove from cart function
  function removeFromCart(variantId, quantity) {
    if (!cartItems[variantId]) return;
    
    cartItems[variantId] -= quantity;
    
    if (cartItems[variantId] <= 0) {
      delete cartItems[variantId];
    }
    
    // Save to localStorage
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
    
    // Update cart via Shopify API
    fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: variantId,
        quantity: cartItems[variantId] || 0
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Cart updated:', data);
      document.dispatchEvent(new CustomEvent('cart:updated'));
    })
    .catch(error => console.error('Error updating cart:', error));
  }
  
  // Update cart button display
  function updateCartButton(card, variantId) {
    const quantity = cartItems[variantId] || 0;
    const cartContainer = card.querySelector('.fc_add_to_cart');
    const addButton = card.querySelector('.add-to-cart');
    const addIcon = card.querySelector('.add_product');
    const removeIcon = card.querySelector('.remove_product');
    
    if (quantity > 0) {
      // Show quantity controls
      addButton.textContent = quantity;
      addButton.classList.add('has-quantity');
      cartContainer.classList.add('show-controls');
      addIcon.style.display = 'flex';
      removeIcon.style.display = 'flex';
      
      // Disable form submission when showing quantity
      addButton.type = 'button';
    } else {
      // Show "Add to Cart" button
      addButton.textContent = 'Add to Cart';
      addButton.classList.remove('has-quantity');
      cartContainer.classList.remove('show-controls');
      addIcon.style.display = 'none';
      removeIcon.style.display = 'none';
      
      // Re-enable form submission
      addButton.type = 'submit';
    }
  }
  
  // Update all product cards on page load
  function updateAllProductCards() {
    document.querySelectorAll('.product-card-primary').forEach(card => {
      const variantId = card.querySelector('input[name="id"]').value;
      updateCartButton(card, variantId);
    });
  }
  
});
