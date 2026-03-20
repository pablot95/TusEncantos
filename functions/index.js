const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

admin.initializeApp();
const db = admin.firestore();

// Credenciales cargadas desde variables de entorno de Firebase
// Configurar con: firebase functions:config:set mercadopago.access_token="TU_TOKEN"
const MP_ACCESS_TOKEN = functions.config().mercadopago?.access_token || process.env.MP_ACCESS_TOKEN || '';

const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

/**
 * Crea una preferencia de pago en MercadoPago.
 * Recibe { orderId } en el body.
 * Lee los productos de Firestore para verificar precios (previene manipulación).
 */
exports.createPreference = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const { orderId } = req.body;
        if (!orderId) { res.status(400).json({ error: 'orderId requerido' }); return; }

        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) { res.status(404).json({ error: 'Orden no encontrada' }); return; }

        const order = orderDoc.data();
        if (order.status !== 'pending') {
            res.status(400).json({ error: 'La orden ya fue procesada' });
            return;
        }

        // Verificar precios desde Firestore (SEGURIDAD: previene manipulación de precios)
        const items = [];
        let verifiedTotal = 0;

        for (const item of order.items) {
            const productDoc = await db.collection('products').doc(item.productId).get();
            if (!productDoc.exists) {
                res.status(400).json({ error: `Producto ${item.productId} no encontrado` });
                return;
            }
            const product = productDoc.data();
            items.push({
                title: product.name,
                quantity: item.qty,
                unit_price: product.price,
                currency_id: 'ARS'
            });
            verifiedTotal += product.price * item.qty;
        }

        // Actualizar orden con total verificado
        await db.collection('orders').doc(orderId).update({ total: verifiedTotal });

        const preference = new Preference(mpClient);
        const result = await preference.create({
            body: {
                items: items,
                back_urls: {
                    success: `https://tusencantosindumentaria.com.ar/?payment=success&orderId=${orderId}`,
                    failure: `https://tusencantosindumentaria.com.ar/?payment=failure&orderId=${orderId}`,
                    pending: `https://tusencantosindumentaria.com.ar/?payment=pending&orderId=${orderId}`
                },
                auto_return: 'approved',
                external_reference: orderId,
                notification_url: `https://us-central1-tusencantos-a09c4.cloudfunctions.net/mercadopagoWebhook`
            }
        });

        res.json({ init_point: result.init_point, id: result.id });

    } catch (err) {
        console.error('Error creando preferencia:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * Webhook de MercadoPago.
 * Recibe notificaciones de pago y actualiza el status de la orden.
 * SEGURIDAD: Solo este webhook puede marcar una orden como 'paid'.
 */
exports.mercadopagoWebhook = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') { res.status(200).send('OK'); return; }

        const { type, data } = req.body;

        if (type === 'payment' && data && data.id) {
            const payment = new Payment(mpClient);
            const paymentInfo = await payment.get({ id: data.id });

            if (paymentInfo.status === 'approved') {
                const orderId = paymentInfo.external_reference;
                if (orderId) {
                    await db.collection('orders').doc(orderId).update({
                        status: 'paid',
                        paymentId: String(data.id),
                        paidAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('Error en webhook:', err);
        res.status(200).send('OK');
    }
});
