document.addEventListener('DOMContentLoaded', () => {

    const sizeBtns = document.querySelectorAll('.size-btn');
    let selectedSize = '';

    sizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sizeBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedSize = btn.textContent.trim();
        });
    });

    const addCartBtn = document.querySelector('.btn-add-cart');
    const buyNowBtn = document.querySelector('.btn-buy-now');

    const productData = {
        id: document.body.dataset.productId,
        name: document.body.dataset.productName,
        price: parseInt(document.body.dataset.productPrice),
        image: document.body.dataset.productImage,
        category: document.body.dataset.productCategory
    };

    const cart = {
        items: JSON.parse(localStorage.getItem('tusencantosCart') || '[]'),

        save() {
            localStorage.setItem('tusencantosCart', JSON.stringify(this.items));
            this.updateUI();
        },

        add(product) {
            const existing = this.items.find(i => i.id === product.id && i.size === product.size);
            if (existing) {
                existing.qty += 1;
            } else {
                this.items.push({ ...product, qty: 1 });
            }
            this.save();
            showToast(product.name + ' agregado al carrito');
            openCart();
        },

        remove(index) {
            this.items.splice(index, 1);
            this.save();
        },

        getTotal() {
            return this.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        },

        updateUI() {
            const count = this.items.reduce((sum, i) => sum + i.qty, 0);
            const countEls = document.querySelectorAll('.nav-cart-count');
            countEls.forEach(el => {
                el.textContent = count;
                el.classList.toggle('visible', count > 0);
            });

            const cartItemsEl = document.getElementById('cart-items');
            const cartTotalPrice = document.getElementById('cart-total-price');

            cartItemsEl.innerHTML = '';
            if (this.items.length === 0) {
                cartItemsEl.innerHTML = '<p style="text-align:center;color:#999;padding:40px 0;font-size:.9rem">Tu carrito está vacío</p>';
            } else {
                this.items.forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'cart-item';
                    div.innerHTML = `
                        <img src="${item.image}" alt="${item.name}" width="70" height="85">
                        <div class="cart-item-info">
                            <h4>${item.name}</h4>
                            <p class="cart-item-size">Talle: ${item.size} — Cant: ${item.qty}</p>
                            <p class="cart-item-price">$${(item.price * item.qty).toLocaleString('es-AR')}</p>
                        </div>
                        <button class="cart-item-remove" data-index="${index}">✕</button>
                    `;
                    cartItemsEl.appendChild(div);
                });
            }

            cartTotalPrice.textContent = '$' + this.getTotal().toLocaleString('es-AR');

            cartItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.remove(parseInt(btn.dataset.index));
                });
            });
        }
    };

    cart.updateUI();

    addCartBtn.addEventListener('click', () => {
        if (!selectedSize) {
            showToast('Seleccioná un talle');
            sizeBtns[0].parentElement.style.animation = 'shake .5s';
            setTimeout(() => sizeBtns[0].parentElement.style.animation = '', 500);
            return;
        }
        cart.add({ ...productData, size: selectedSize });
        addCartBtn.classList.add('added');
        setTimeout(() => addCartBtn.classList.remove('added'), 600);
    });

    buyNowBtn.addEventListener('click', () => {
        if (!selectedSize) {
            showToast('Seleccioná un talle');
            return;
        }
        cart.add({ ...productData, size: selectedSize });
        showToast('Redirigiendo al checkout...');
    });

    const cartDrawer = document.getElementById('cart-drawer');
    const closeCartEl = document.getElementById('close-cart');
    const cartOverlay = document.getElementById('cart-overlay');
    const navCartBtn = document.querySelector('.nav-cart');

    function openCart() {
        cartDrawer.classList.add('open');
        cartOverlay.classList.add('visible');
    }
    function closeCart() {
        cartDrawer.classList.remove('open');
        cartOverlay.classList.remove('visible');
    }

    navCartBtn.addEventListener('click', openCart);
    closeCartEl.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    function showToast(message) {
        const existing = document.querySelector('.notification-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 400);
        }, 2500);
    }

    const gallery = document.querySelector('.product-gallery');
    const galleryImg = gallery.querySelector('img');

    gallery.addEventListener('mousemove', (e) => {
        const rect = gallery.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        galleryImg.style.transformOrigin = x + '% ' + y + '%';
        galleryImg.style.transform = 'scale(1.5)';
    });

    gallery.addEventListener('mouseleave', () => {
        galleryImg.style.transformOrigin = 'center center';
        galleryImg.style.transform = 'scale(1)';
    });

    const style = document.createElement('style');
    style.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}';
    document.head.appendChild(style);

});