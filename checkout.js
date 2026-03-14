document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('checkout-form');
    const billingCheckbox = document.getElementById('billing-different');
    const billingFields = document.getElementById('billing-fields');
    const summaryItemsEl = document.getElementById('summary-items');
    const summaryTotalEl = document.getElementById('summary-total-price');
    const btnPay = document.getElementById('btn-pay');
    const toastEl = document.getElementById('checkout-toast');

    const cartRaw = JSON.parse(localStorage.getItem('tusencantosCart') || '[]');

    if (cartRaw.length === 0) {
        summaryItemsEl.innerHTML = '<p class="summary-loading">Tu carrito está vacío</p>';
        return;
    }

    // --- Verificar precios desde Firestore (previene manipulación de precios) ---
    let verifiedItems = [];
    try {
        const productIds = [...new Set(cartRaw.map(i => i.id))];
        const priceMap = {};

        for (const pid of productIds) {
            const doc = await db.collection('products').doc(pid).get();
            if (doc.exists) {
                const data = doc.data();
                priceMap[pid] = { price: data.price, name: data.name, image: data.image };
            }
        }

        verifiedItems = cartRaw.map(item => {
            const verified = priceMap[item.id];
            if (verified) {
                return {
                    id: item.id,
                    name: verified.name,
                    price: verified.price,
                    image: verified.image,
                    size: item.size,
                    qty: item.qty
                };
            }
            return { ...item };
        });
    } catch (err) {
        verifiedItems = cartRaw;
    }

    function renderSummary() {
        summaryItemsEl.innerHTML = '';
        let total = 0;
        verifiedItems.forEach(item => {
            const subtotal = item.price * item.qty;
            total += subtotal;
            const div = document.createElement('div');
            div.className = 'summary-item';
            div.innerHTML = `
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" width="56" height="68">
                <div class="summary-item-info">
                    <h4>${escapeHtml(item.name)}</h4>
                    <p class="item-meta">Talle: ${escapeHtml(item.size)} — Cant: ${item.qty}</p>
                    <p class="item-price">$${subtotal.toLocaleString('es-AR')}</p>
                </div>
            `;
            summaryItemsEl.appendChild(div);
        });
        summaryTotalEl.textContent = '$' + total.toLocaleString('es-AR');
        btnPay.disabled = false;
    }

    renderSummary();

    // --- Toggle facturación ---
    billingCheckbox.addEventListener('change', () => {
        billingFields.classList.toggle('hidden', !billingCheckbox.checked);
    });

    // --- Validación ---
    function validateForm() {
        let valid = true;
        const required = ['ship-name', 'ship-lastname', 'ship-email', 'ship-phone', 'ship-address'];
        required.forEach(id => {
            const el = document.getElementById(id);
            if (!el.value.trim()) {
                el.classList.add('error');
                valid = false;
            } else {
                el.classList.remove('error');
            }
        });

        const emailEl = document.getElementById('ship-email');
        if (emailEl.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
            emailEl.classList.add('error');
            valid = false;
        }

        if (billingCheckbox.checked) {
            const billRequired = ['bill-name', 'bill-lastname', 'bill-email', 'bill-phone', 'bill-address'];
            billRequired.forEach(id => {
                const el = document.getElementById(id);
                if (!el.value.trim()) {
                    el.classList.add('error');
                    valid = false;
                } else {
                    el.classList.remove('error');
                }
            });
        }

        return valid;
    }

    // --- Crear orden ---
    btnPay.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            showToast('Completá todos los campos obligatorios', 'error');
            return;
        }

        btnPay.disabled = true;
        btnPay.textContent = 'Procesando...';

        try {
            // Re-verificar precios desde Firestore al momento del pago
            const freshItems = [];
            let freshTotal = 0;
            const btnPayOriginalHTML = btnPay.innerHTML;
            for (const item of verifiedItems) {
                const doc = await db.collection('products').doc(item.id).get();
                if (!doc.exists) {
                    showToast('Producto no encontrado: ' + item.name, 'error');
                    btnPay.disabled = false;
                    btnPay.innerHTML = btnPayOriginalHTML;
                    return;
                }
                const data = doc.data();
                const availableStock = data.stock != null ? data.stock : 0;
                if (availableStock === 0) {
                    showToast(data.name + ' está sin stock. Eliminalo del carrito para continuar.', 'error');
                    btnPay.disabled = false;
                    btnPay.innerHTML = btnPayOriginalHTML;
                    return;
                }
                if (item.qty > availableStock) {
                    showToast(data.name + ': solo hay ' + availableStock + ' unidades disponibles (tenés ' + item.qty + ')', 'error');
                    btnPay.disabled = false;
                    btnPay.innerHTML = btnPayOriginalHTML;
                    return;
                }
                freshItems.push({
                    productId: item.id,
                    name: data.name,
                    price: data.price,
                    size: item.size,
                    qty: item.qty,
                    image: data.image
                });
                freshTotal += data.price * item.qty;
            }

            const shipping = {
                name: document.getElementById('ship-name').value.trim(),
                lastname: document.getElementById('ship-lastname').value.trim(),
                email: document.getElementById('ship-email').value.trim(),
                phone: document.getElementById('ship-phone').value.trim(),
                address: document.getElementById('ship-address').value.trim(),
                message: document.getElementById('ship-message').value.trim()
            };

            let billing = null;
            if (billingCheckbox.checked) {
                billing = {
                    name: document.getElementById('bill-name').value.trim(),
                    lastname: document.getElementById('bill-lastname').value.trim(),
                    email: document.getElementById('bill-email').value.trim(),
                    phone: document.getElementById('bill-phone').value.trim(),
                    address: document.getElementById('bill-address').value.trim()
                };
            }

            const order = {
                items: freshItems,
                shipping: shipping,
                billing: billing,
                total: freshTotal,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('orders').add(order);

            localStorage.removeItem('tusencantosCart');

            showToast('Orden creada. Redirigiendo a Mercado Pago...', 'success');

            // Crear preferencia de pago en MercadoPago via API PHP
            const mpResponse = await fetch('api/create-preference.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: docRef.id,
                    items: freshItems.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
                    payerEmail: shipping.email
                })
            });

            const mpData = await mpResponse.json();

            if (!mpResponse.ok || !mpData.init_point) {
                showToast('Error al conectar con Mercado Pago: ' + (mpData.error || 'Intenta de nuevo'), 'error');
                btnPay.disabled = false;
                btnPay.innerHTML = '<svg class="mp-icon" width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="3" stroke="#009EE3" stroke-width="2"/><path d="M1 10h22" stroke="#009EE3" stroke-width="2"/><rect x="4" y="14" width="6" height="2" rx="1" fill="#009EE3"/></svg> Pagar con Mercado Pago';
                return;
            }

            // Guardar preferencia en la orden de Firestore
            await db.collection('orders').doc(docRef.id).update({
                preferenceId: mpData.preference_id
            }).catch(() => {});

            // Redirigir a MercadoPago (sandbox en modo test)
            window.location.href = mpData.sandbox_init_point || mpData.init_point;

        } catch (err) {
            showToast('Error al crear la orden: ' + err.message, 'error');
            btnPay.disabled = false;
            btnPay.innerHTML = '<svg class="mp-icon" width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="3" stroke="#009EE3" stroke-width="2"/><path d="M1 10h22" stroke="#009EE3" stroke-width="2"/><rect x="4" y="14" width="6" height="2" rx="1" fill="#009EE3"/></svg> Pagar con Mercado Pago';
        }
    });

    // --- Utilidades ---
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    let toastTimer;
    function showToast(message, type) {
        clearTimeout(toastTimer);
        toastEl.textContent = message;
        toastEl.className = 'checkout-toast visible ' + (type || '');
        toastTimer = setTimeout(() => {
            toastEl.className = 'checkout-toast';
        }, 4000);
    }

    form.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', () => el.classList.remove('error'));
    });
});
