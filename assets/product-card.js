document.addEventListener("DOMContentLoaded", function () {
  function initVariantDropdown() {
    // Only for screens up to 767px
    if (window.innerWidth > 767) return;

    // Target all product cards inside .fruits_cards_slider.for_responsive
    const productCards = document.querySelectorAll(
      ".product-card-primary"
    );

    productCards.forEach((card) => {
      const variantWrap = card.querySelector(".fc_variant_wrap");
      const variants = card.querySelectorAll(".fc_variant_item");
      const dropdown = card.querySelector(".selected_variant_dropdown");
      if (!variantWrap || !variants.length || !dropdown) return;

      // Prevent duplicate initialization
      if (card.classList.contains("dropdown-initialized")) return;
      card.classList.add("dropdown-initialized");

      // Create a new div for showing the selected variant
      let selectedVariantDiv = card.querySelector(".selected_product_variant");
      if (!selectedVariantDiv) {
        selectedVariantDiv = document.createElement("div");
        selectedVariantDiv.classList.add("selected_product_variant");
        dropdown.appendChild(selectedVariantDiv);
      }

      // Initially show only the active variant in the new div
      const active = variantWrap.querySelector(".fc_variant_item.active");
      if (active) selectedVariantDiv.innerHTML = active.outerHTML;

      // Hide the variant list initially
      variantWrap.style.display = "none";

      // Toggle open/close on click of selected variant div
      selectedVariantDiv.addEventListener("click", function () {
        const isOpen = variantWrap.style.display === "block";
        variantWrap.style.display = isOpen ? "none" : "block";
        selectedVariantDiv.classList.toggle("open", !isOpen);
      });

      // When a variant is clicked, make it active and update the selected div
      variants.forEach((v) => {
        v.addEventListener("click", function () {
          variants.forEach((el) => el.classList.remove("active"));
          this.classList.add("active");
          selectedVariantDiv.innerHTML = this.outerHTML;
          variantWrap.style.display = "none";
          selectedVariantDiv.classList.remove("open");
        });
      });
    });
  }

  // Run once on load (only ≤767px)
  if (window.innerWidth <= 767) {
    initVariantDropdown();
  }

  // Handle resize events — only activate/deactivate when crossing 767px
  let wasMobile = window.innerWidth <= 767;

  window.addEventListener("resize", function () {
    const isMobile = window.innerWidth <= 767;

    // If switching from desktop to mobile, initialize
    if (!wasMobile && isMobile) {
      initVariantDropdown();
    }

    // If switching from mobile to desktop, reset everything
    if (wasMobile && !isMobile) {
      document
        .querySelectorAll(".fc_variant_wrap")
        .forEach((el) => (el.style.display = ""));
      document
        .querySelectorAll(".selected_variant_dropdown")
        .forEach((el) => (el.innerHTML = ""));
      document
        .querySelectorAll(".dropdown-initialized")
        .forEach((el) => el.classList.remove("dropdown-initialized"));
    }

    wasMobile = isMobile;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  function getInventoryMessage(inventory) {
    const qty = parseInt(inventory, 10) || 0;
    const template = window.themeStrings?.inventoryStatus || "Only __COUNT__ left";
    if (qty <= 0) return window.themeStrings?.outOfStock || "Out of stock";
    if (qty < 100) return template.replace("__COUNT__", qty);
    return window.themeStrings?.inStock || "In stock";
  }

  document.querySelectorAll(".product-card-primary").forEach((card) => {
    const variantItems = card.querySelectorAll(".fc_variant_item");
    const priceContainer = card.querySelector(".fc_price_weight p");
    const sellingPrice = card.querySelector(".selling_price");
    const comparePrice = card.querySelector("strike");
    const addToCartInput = card.querySelector('input[name="id"]');
    const trustText = card.querySelector(".fc_trust_text p");
    const mainImg = card.querySelector(".fc_image .main_img");
    const perKg = card.querySelector(".fc_weight");

    variantItems.forEach((variant) => {
      variant.addEventListener("click", () => {
        // Remove existing active class
        variantItems.forEach((v) => v.classList.remove("active"));
        variant.classList.add("active");

        // Read data attributes
        const price = variant.dataset.price;
        const compare = variant.dataset.compare;
        const inventory = variant.dataset.inventory;
        const variantId = variant.dataset.id;
        const image = variant.dataset.image;
        const perKgfinal = variant.dataset.unit;

        // Update prices
        if (sellingPrice) sellingPrice.textContent = price;
        if (comparePrice) {
          if (compare && compare !== price) {
            comparePrice.textContent = compare;
            comparePrice.style.display = "inline";
          } else {
            comparePrice.style.display = "none";
          }
        }

        if (addToCartInput) addToCartInput.value = variantId;

        if (trustText) {
          const inventoryQty = parseInt(inventory, 10) || 0;
          trustText.textContent = getInventoryMessage(inventoryQty);
          trustText.classList.toggle("low-stock", inventoryQty > 0 && inventoryQty < 100);
        }

        if (image && mainImg) mainImg.src = image;

        if (perKg) {
          if (perKgfinal) {
            perKg.textContent = perKgfinal;
            perKg.style.display = "";
          } else {
            perKg.textContent = "";
            perKg.style.display = "none";
          }
        }
      });
    });
  });
});


const sliders = document.querySelectorAll('.fc_variant_wrap');

sliders.forEach((slider) => {
  let isDown = false;
  let startX;
  let scrollLeft;

  slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.classList.add('active');
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });

  slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.classList.remove('active');
  });

  slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.classList.remove('active');
  });

  slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 3; // scroll speed
    slider.scrollLeft = scrollLeft - walk;
  });
});
