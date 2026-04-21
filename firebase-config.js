const firebaseConfig = {
    apiKey: "AIzaSyC8Za5OjMa1O2ScfXVSK6dI0ZIBhX_BdHk",
    authDomain: "tusencantos-a09c4.firebaseapp.com",
    projectId: "tusencantos-a09c4",
    storageBucket: "tusencantos-a09c4.firebasestorage.app",
    messagingSenderId: "10740251085",
    appId: "1:10740251085:web:6a1f582da6c30cda932c84"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;

const CATEGORIES = [
    'Jeans', 'Remeras', 'Suéteres', 'Buzos', 'Calzas',
    'Camperas', 'Chalecos', 'Camisas', 'Carteras', 'Bolsos',
    'Short', 'Vestidos', 'Sacos largos', 'Tapados de paño', 'Deportivo', 'Bufandones'
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const JEAN_SIZES = ['36', '38', '40', '42', '44', '46'];
// Colores disponibles para todas las categorías
const COLORS = ['Beige', 'Rojo', 'Negro', 'Chocolate', 'Crudo', 'Blanco', 'Rosa bb', 'Fucsia', 'Verde militar', 'Verde benetton', 'Verde agua', 'Gris'];
// Alias de compatibilidad
const SWEATER_COLORS = COLORS;
