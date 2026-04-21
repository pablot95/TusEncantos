document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('checkout-form');
    const billingCheckbox = document.getElementById('billing-different');
    const billingFields = document.getElementById('billing-fields');
    const summaryItemsEl = document.getElementById('summary-items');
    const summaryTotalEl = document.getElementById('summary-total-price');
    const btnPay = document.getElementById('btn-pay');
    const toastEl = document.getElementById('checkout-toast');

    // --- EmailJS init ---
    emailjs.init('zZVYrIA_Jay4XSmPU');

    // --- Detectar retorno de MercadoPago ---
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const returnOrderId = urlParams.get('orderId');

    if (paymentStatus === 'success' && returnOrderId) {
        await handlePaymentSuccess(returnOrderId);
        return;
    }

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
                    color: item.color || '',
                    qty: item.qty
                };
            }
            return { ...item };
        });
    } catch (err) {
        verifiedItems = cartRaw;
    }

    // --- Método de pago ---
    let selectedMethod = 'mp'; // 'mp' | 'transfer'
    const transferDataEl = document.getElementById('transfer-data');
    const discountRow = document.getElementById('summary-discount-row');
    const discountAmountEl = document.getElementById('summary-discount-amount');
    const cardIconsEl = document.getElementById('card-icons');
    const paymentNoteEl = document.getElementById('payment-note');
    const WHATSAPP_NUMBER = '5493874819296';
    const shippingRowEl = document.getElementById('summary-shipping-row');
    const shippingPriceEl = document.getElementById('summary-shipping-price');
    const shippingLabelEl = document.getElementById('shipping-label');

    // --- Costos de envío ---
    const FREE_SHIPPING_THRESHOLD = 150000;

    function getShippingCost(baseTotal) {
        if (baseTotal >= FREE_SHIPPING_THRESHOLD) return 0;
        return 'acordar'; // A acordar con el vendedor
    }

    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
        radio.addEventListener('change', () => {
            selectedMethod = radio.value;
            document.querySelectorAll('.payment-method-option').forEach(l => l.classList.remove('active'));
            radio.closest('.payment-method-option').classList.add('active');
            renderSummary();
            if (selectedMethod === 'transfer') {
                transferDataEl.classList.remove('hidden');
                cardIconsEl.classList.add('hidden');
                paymentNoteEl.textContent = 'Realizá la transferencia y enviá el comprobante. Confirmamos tu pedido al recibir el pago.';
                btnPay.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h3M14 15h3"/></svg> Confirmar pedido por transferencia`;
                btnPay.style.background = '#27ae60';
            } else {
                transferDataEl.classList.add('hidden');
                cardIconsEl.classList.remove('hidden');
                paymentNoteEl.textContent = 'Te llevaremos a Mercado Pago para terminar la operación.';
                btnPay.innerHTML = `<svg class="mp-icon" width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="3" stroke="#009EE3" stroke-width="2"/><path d="M1 10h22" stroke="#009EE3" stroke-width="2"/><rect x="4" y="14" width="6" height="2" rx="1" fill="#009EE3"/></svg> Pagar con Mercado Pago`;
                btnPay.style.background = '';
            }
        });
    });

    // Copiar CBU/Alias
    document.querySelectorAll('.copyable').forEach(el => {
        el.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(el.dataset.copy).then(() => {
                showToast('¡Copiado!', 'success');
            });
        });
    });

    function renderSummary() {
        summaryItemsEl.innerHTML = '';
        let baseTotal = 0;
        verifiedItems.forEach(item => {
            const subtotal = item.price * item.qty;
            baseTotal += subtotal;
            const div = document.createElement('div');
            div.className = 'summary-item';
            div.innerHTML = `
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" width="56" height="68">
                <div class="summary-item-info">
                    <h4>${escapeHtml(item.name)}</h4>
                    <p class="item-meta">Talle: ${escapeHtml(item.size)}${item.color ? ' — Color: ' + escapeHtml(item.color) : ''} — Cant: ${item.qty}</p>
                    <p class="item-price">$${subtotal.toLocaleString('es-AR')}</p>
                </div>
            `;
            summaryItemsEl.appendChild(div);
        });

        let displayTotal = baseTotal;
        if (selectedMethod === 'transfer') {
            const discount = Math.round(baseTotal * 0.20);
            displayTotal = baseTotal - discount;
            discountAmountEl.textContent = '-$' + discount.toLocaleString('es-AR');
            discountRow.classList.remove('hidden');
        } else {
            discountRow.classList.add('hidden');
        }

        // Envío se calcula sobre el subtotal sin descuento
        const shippingCost = getShippingCost(baseTotal);
        if (shippingCost === 0) {
            shippingPriceEl.textContent = '¡GRATIS!';
            shippingPriceEl.className = 'shipping-free';
            shippingLabelEl.textContent = 'Envío';
        } else {
            shippingPriceEl.textContent = 'A acordar con el vendedor';
            shippingPriceEl.className = 'shipping-pending';
            shippingLabelEl.textContent = 'Envío';
        }

        const finalTotal = displayTotal + (shippingCost === 0 ? 0 : 0);
        summaryTotalEl.textContent = '$' + finalTotal.toLocaleString('es-AR');

        btnPay.disabled = false;
    }

    renderSummary();

    // --- Toggle facturación ---
    billingCheckbox.addEventListener('change', () => {
        billingFields.classList.toggle('hidden', !billingCheckbox.checked);
    });

    // Actualizar link de WhatsApp al cargar (link genérico)
    document.getElementById('btn-whatsapp').href =
        `https://wa.me/5493874819296?text=Hola!%20Quiero%20enviar%20el%20comprobante%20de%20mi%20pedido.`;
    // --- Validación ---
    function validateForm() {
        let valid = true;
        const required = ['ship-name', 'ship-lastname', 'ship-email', 'ship-phone', 'ship-address', 'ship-city', 'ship-province'];
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
                // Soporte para stock anidado (talle+color), por talle, o global (legado)
                let stockVal = 0;
                if (typeof data.stock === 'object' && data.stock !== null) {
                    const sizeVal = data.stock[item.size];
                    if (typeof sizeVal === 'object' && sizeVal !== null) {
                        // Stock anidado: talle → { color: n }
                        stockVal = item.color ? (sizeVal[item.color] ?? 0) : Object.values(sizeVal).reduce((a, b) => a + b, 0);
                    } else {
                        stockVal = sizeVal ?? 0;
                    }
                } else {
                    stockVal = data.stock ?? 0;
                }
                const stockLabel = item.color ? 'talle ' + item.size + ' / ' + item.color : 'talle ' + item.size;
                if (stockVal === 0) {
                    showToast(data.name + ' (' + stockLabel + ') está sin stock. Eliminalo del carrito para continuar.', 'error');
                    btnPay.disabled = false;
                    btnPay.innerHTML = btnPayOriginalHTML;
                    return;
                }
                if (item.qty > stockVal) {
                    showToast(data.name + ' (' + stockLabel + '): solo hay ' + stockVal + ' unidades disponibles (tenés ' + item.qty + ')', 'error');
                    btnPay.disabled = false;
                    btnPay.innerHTML = btnPayOriginalHTML;
                    return;
                }
                freshItems.push({
                    productId: item.id,
                    name: data.name,
                    price: data.price,
                    size: item.size,
                    color: item.color || '',
                    qty: item.qty,
                    image: data.image
                });
                freshTotal += data.price * item.qty;
            }

            // Aplicar descuento por transferencia
            const isTransfer = selectedMethod === 'transfer';
            const baseTotalBeforeDiscount = freshTotal;
            if (isTransfer) {
                freshTotal = Math.round(freshTotal * 0.80);
            }

            // Calcular envío sobre subtotal sin descuento
            const shippingCostRaw = getShippingCost(baseTotalBeforeDiscount);
            const shippingCost = shippingCostRaw === 0 ? 0 : 0; // A acordar: no suma al total
            const shippingDisplay = shippingCostRaw === 0 ? 0 : 'acordar';
            freshTotal += shippingCost;

            const shipping = {
                name: document.getElementById('ship-name').value.trim(),
                lastname: document.getElementById('ship-lastname').value.trim(),
                email: document.getElementById('ship-email').value.trim(),
                phone: document.getElementById('ship-phone').value.trim(),
                address: document.getElementById('ship-address').value.trim(),
                city: document.getElementById('ship-city').value.trim(),
                province: document.getElementById('ship-province').value.trim(),
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
                subtotal: baseTotalBeforeDiscount,
                shippingCost: shippingDisplay,
                total: freshTotal,
                paymentMethod: isTransfer ? 'transfer' : 'mercadopago',
                status: isTransfer ? 'pending_transfer' : 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('orders').add(order);

            localStorage.removeItem('tusencantosCart');

            if (isTransfer) {
                // Flujo transferencia: redirigir a WhatsApp con los datos del pedido
                const itemsList = freshItems.map(i => `• ${i.name} (Talle: ${i.size}${i.color ? ', Color: ' + i.color : ''}) x${i.qty}`).join('%0A');
                const shippingText = shippingCostRaw === 0 ? 'Env%C3%ADo: GRATIS' : 'Env%C3%ADo: A%20acordar%20con%20el%20vendedor';
                const msg = `Hola! Quiero enviar el comprobante de mi pedido.%0A%0A*Pedido #${docRef.id}*%0A${itemsList}%0A%0A${shippingText}%0A*Total: $${freshTotal.toLocaleString('es-AR')}* (con 20% descuento transferencia)%0A%0ADatos de envío: ${shipping.name} ${shipping.lastname} - ${shipping.address}, ${shipping.city}, ${shipping.province}`;
                showToast('¡Pedido creado! Redirigiendo a WhatsApp...', 'success');
                setTimeout(() => {
                    window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
                }, 1500);
                return;
            }

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

            // Guardar datos de la orden para enviar emails al volver
            sessionStorage.setItem('tusencantosOrder', JSON.stringify({
                orderId: docRef.id,
                items: freshItems,
                shipping: shipping,
                total: freshTotal
            }));

            // Redirigir a MercadoPago
            window.location.href = mpData.init_point;

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

    form.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('input', () => el.classList.remove('error'));
        el.addEventListener('change', () => el.classList.remove('error'));
    });

    // --- Manejo de pago exitoso (retorno desde MercadoPago) ---
    async function handlePaymentSuccess(orderId) {
        // Mostrar pantalla de confirmación
        document.querySelector('.checkout-page').innerHTML = `
            <div class="container" style="text-align:center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
                <h1 style="font-family:'Playfair Display',serif; color:#333; margin-bottom:12px;">¡Gracias por tu compra!</h1>
                <p style="color:#666; font-size:1.1rem; margin-bottom:8px;">Tu pago fue procesado con éxito.</p>
                <p style="color:#999; font-size:0.95rem; margin-bottom:32px;" id="email-status">Verificando pago...</p>
                <a href="index.html" style="display:inline-block; background:#F6AFCB; color:#fff; padding:14px 36px; border-radius:30px; text-decoration:none; font-weight:600; font-family:'Lato',sans-serif;">Volver a la tienda</a>
            </div>
        `;

        const emailStatusEl = document.getElementById('email-status');

        // ---- Verificar con el servidor que el pago realmente fue aprobado ----
        // El webhook de MercadoPago escribe el resultado en /payments/{orderId}.json.
        // Reintentamos hasta 10 veces con 2 s de espera para cubrir la latencia del webhook.
        let paymentVerified = false;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                const checkResp = await fetch('api/check-payment.php?orderId=' + encodeURIComponent(orderId));
                if (checkResp.ok) {
                    const checkData = await checkResp.json();
                    if (checkData.status === 'approved') {
                        paymentVerified = true;
                        break;
                    }
                    // Si fue rechazado, no tiene sentido seguir esperando
                    if (checkData.status === 'rejected' || checkData.status === 'cancelled') break;
                }
            } catch (_) { /* ignorar errores de red temporales */ }
            if (attempt < 9) await new Promise(r => setTimeout(r, 2000));
        }

        if (!paymentVerified) {
            emailStatusEl.textContent = 'Tu pago está siendo procesado. Recibirás un email de confirmación en breve.';
            return;
        }

        try {
            // Leer datos guardados en sessionStorage (no requiere auth de Firestore)
            const savedRaw = sessionStorage.getItem('tusencantosOrder');

            let shipping, items, total, finalOrderId;

            if (savedRaw) {
                // Caso normal: sessionStorage disponible
                const saved = JSON.parse(savedRaw);
                sessionStorage.removeItem('tusencantosOrder');
                shipping = saved.shipping || {};
                items = saved.items || [];
                total = saved.total || 0;
                finalOrderId = saved.orderId || orderId;
            } else {
                // Fallback: sessionStorage vacío (Safari/iOS lo pierde al navegar a otro dominio)
                // Leemos la orden directamente desde Firestore usando el orderId de la URL
                finalOrderId = orderId;
                try {
                    const orderDoc = await db.collection('orders').doc(orderId).get();
                    if (orderDoc.exists) {
                        const orderData = orderDoc.data();
                        shipping = orderData.shipping || {};
                        items = (orderData.items || []).map(i => ({
                            ...i,
                            id: i.productId || i.id,
                            price: i.price,
                            qty: i.qty
                        }));
                        total = orderData.total || 0;
                    } else {
                        emailStatusEl.textContent = 'No se pudo enviar el email de confirmación.';
                        return;
                    }
                } catch (fsErr) {
                    console.error('Error leyendo orden de Firestore:', fsErr);
                    emailStatusEl.textContent = 'No se pudo enviar el email de confirmación.';
                    return;
                }
            }

            // Reducir stock y actualizar estado de la orden en Firestore
            try {
                const stockUpdates = [];

                // Agrupar cantidades por (productId, talle, color)
                const qtyByProductSizeColor = {};
                items.forEach(item => {
                    const pid = item.productId || item.id;
                    const size = item.size;
                    const color = item.color || '';
                    if (pid && size) {
                        if (!qtyByProductSizeColor[pid]) qtyByProductSizeColor[pid] = [];
                        qtyByProductSizeColor[pid].push({ size, color, qty: item.qty });
                    }
                });

                // Reducir stock por talle+color con incremento atómico
                Object.entries(qtyByProductSizeColor).forEach(([productId, entries]) => {
                    const updates = {};
                    entries.forEach(({ size, color, qty }) => {
                        if (color) {
                            // Stock anidado: stock.Talle.Color
                            updates[`stock.${size}.${color}`] = firebase.firestore.FieldValue.increment(-qty);
                        } else {
                            // Stock plano por talle (sin colores)
                            updates[`stock.${size}`] = firebase.firestore.FieldValue.increment(-qty);
                        }
                    });
                    stockUpdates.push(
                        db.collection('products').doc(productId).update(updates)
                            .catch(err => console.error('Error reduciendo stock de ' + productId + ':', err))
                    );
                });

                // Actualizar estado de la orden a "approved"
                if (finalOrderId) {
                    stockUpdates.push(
                        db.collection('orders').doc(finalOrderId).update({
                            status: 'approved',
                            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).catch(err => console.error('Error actualizando orden:', err))
                    );
                }

                await Promise.all(stockUpdates);
            } catch (err) {
                console.error('Error al actualizar stock/orden:', err);
            }

            // Construir tabla de productos para el email
            const itemsHtml = items.map(item =>
                `<tr>
                    <td style="padding:10px 12px; border-bottom:1px solid #f0e6eb;">${item.name}</td>
                    <td style="padding:10px 12px; border-bottom:1px solid #f0e6eb; text-align:center;">${item.size || '-'}</td>
                    <td style="padding:10px 12px; border-bottom:1px solid #f0e6eb; text-align:center;">${item.qty}</td>
                    <td style="padding:10px 12px; border-bottom:1px solid #f0e6eb; text-align:right;">$${(item.price * item.qty).toLocaleString('es-AR')}</td>
                </tr>`
            ).join('');

            const itemsList = items.map(item =>
                `• ${item.name} (Talle: ${item.size || '-'}) x${item.qty} — $${(item.price * item.qty).toLocaleString('es-AR')}`
            ).join('\n');

            const totalFormatted = '$' + total.toLocaleString('es-AR');
            const customerName = `${shipping.name || ''} ${shipping.lastname || ''}`.trim();
            const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

            const templateParams = {
                order_id: finalOrderId,
                customer_name: customerName,
                customer_email: shipping.email || '',
                customer_phone: shipping.phone || '',
                customer_address: shipping.address || '',
                customer_message: shipping.message || 'Sin mensaje',
                items_html: itemsHtml,
                items_list: itemsList,
                order_total: totalFormatted,
                order_date: fecha,
            };

            // Enviar email al comprador
            const buyerPromise = emailjs.send('service_4yy6g8m', 'template_zxd7u0h', templateParams)
                .catch(err => console.error('Email comprador falló:', err));

            // Enviar email al vendedor
            const sellerPromise = emailjs.send('service_4yy6g8m', 'template_3guc91a', templateParams)
                .catch(err => console.error('Email vendedor falló:', err));

            await Promise.all([buyerPromise, sellerPromise]);
            emailStatusEl.textContent = 'Te enviamos un email de confirmación 📩';

        } catch (err) {
            console.error('Error al enviar emails:', err);
            emailStatusEl.textContent = 'No se pudo enviar el email de confirmación.';
        }
    }
});
