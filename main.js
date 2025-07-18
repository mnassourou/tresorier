// Fichier: main.js

// !!! IMPORTANT: Remplacez cette URL par l'URL de votre application web Google Apps Script que vous avez copiée !!!
// Cette URL commence par 'https://script.google.com/macros/s/...'
const SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxHRGkI0jSjE9zwlSyuMqZhRpg4tH01UcqdiqpfAR-GZJj0B2f62Q10A92h1_Xw41En9w/exec'; 

// --- Fonctions utilitaires pour interagir avec le Google Apps Script ---

/**
 * Effectue une requête GET vers l'API Apps Script en utilisant JSONP pour contourner les problèmes CORS.
 * @param {string} action - L'action à effectuer sur l'API.
 * @param {object} params - Les paramètres à envoyer avec la requête.
 * @returns {Promise<object>} Une promesse qui résout avec les données de la réponse.
 */
function fetchData(action, params = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(SCRIPT_WEB_APP_URL);
        url.searchParams.append('action', action);
        
        // Génère un nom de fonction de rappel unique pour JSONP
        const callbackName = 'jsonpCallback_' + Date.now() + Math.random().toString(36).substring(2, 8);
        url.searchParams.append('callback', callbackName);

        for (const key in params) {
            url.searchParams.append(key, params[key]);
        }

        const script = document.createElement('script');
        script.src = url.toString();
        document.body.appendChild(script);

        // Définit la fonction de rappel globale qui sera appelée par le script Apps Script
        window[callbackName] = (data) => {
            document.body.removeChild(script); // Nettoie le script une fois qu'il a été exécuté
            delete window[callbackName];       // Supprime la fonction globale pour éviter les fuites de mémoire
            resolve(data);
        };

        // Gère les erreurs de chargement du script (ex: URL incorrecte, problème réseau)
        script.onerror = (error) => {
            document.body.removeChild(script);
            delete window[callbackName];
            console.error("Erreur de chargement du script JSONP:", error);
            reject({ success: false, message: "Erreur de chargement du script JSONP. Vérifiez l'URL de l'API." });
        };

        // Gère les cas où le script ne répond pas dans un délai raisonnable
        setTimeout(() => {
            if (window[callbackName]) { // Si le callback n'a pas été appelé
                document.body.removeChild(script);
                delete window[callbackName];
                reject({ success: false, message: "Timeout: l'API n'a pas répondu à temps." });
            }
        }, 15000); // 15 secondes de timeout pour les requêtes GET
    });
}

/**
 * Effectue une requête POST vers l'API Apps Script.
 * Les requêtes POST fonctionnent généralement bien avec les en-têtes CORS standards.
 * @param {string} action - L'action à effectuer sur l'API.
 * @param {object} data - Les données à envoyer avec la requête.
 * @returns {Promise<object>} Une promesse qui résout avec les données de la réponse.
 */
async function postData(action, data) {
    const url = new URL(SCRIPT_WEB_APP_URL);
    url.searchParams.append('action', action);

    // Convertir les dates au format YYYY-MM-DD (important pour Google Sheets)
    if (data.date) {
        data.date = new Date(data.date).toISOString().split('T')[0];
    }

    const formData = new FormData();
    for (const key in data) {
        formData.append(key, data[key]);
    }

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            body: formData,
            mode: 'cors', // Spécifiez 'cors' explicitement
            credentials: 'omit' // Ne pas envoyer de cookies/credentials pour cette API publique
        });

        if (!response.ok) {
            // Tente de lire le message d'erreur du serveur si disponible
            const errorText = await response.text();
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}. Réponse: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Erreur lors de l'envoi des données:", error);
        return { success: false, message: "Erreur de connexion aux serveurs ou API: " + error.message };
    }
}

// --- Gestion des onglets ---
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.dataset.tab;

        // Désactive tous les boutons d'onglet et contenus
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Active le bouton et le contenu de l'onglet sélectionné
        button.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // Charge les données spécifiques à l'onglet lors de l'activation
        if (tabId === 'dashboard') {
            loadDashboardData();
        } else if (tabId === 'receipts') {
            loadMembersForSelect();
            setDefaultDate('receiptDate');
        } else if (tabId === 'expenses') {
            setDefaultDate('expenseDate');
        } else if (tabId === 'history') {
            loadHistoryTable();
        }
    });
});

/**
 * Définit la date par défaut pour un champ d'entrée de type 'date' à la date du jour.
 * @param {string} elementId - L'ID de l'élément input de type date.
 */
function setDefaultDate(elementId) {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const element = document.getElementById(elementId);
    if (element) {
        element.value = today;
    }
}

// --- Fonctionnalités spécifiques à chaque onglet ---

// Tableau de Bord
async function loadDashboardData() {
    // Récupère les données des recettes et dépenses. Note: Ces calculs sont faits côté client.
    // Pour des calculs plus complexes ou des balances d'ouverture, le Google Sheet est le maître.
    const receiptsResponse = await fetchData('getReceipts');
    const expensesResponse = await fetchData('getExpenses');

    const receipts = receiptsResponse.success ? receiptsResponse.data : [];
    const expenses = expensesResponse.success ? expensesResponse.data : [];

    let soldeEspeces = 0;
    let soldeBancaire = 0;
    let soldeOrangeMoney = 0;
    let soldeMtnMoney = 0;
    let soldeTotal = 0;

    receipts.forEach(r => {
        const montant = parseFloat(r.Montant);
        if (isNaN(montant)) return;
        if (r.CanaldePaiement === 'Espèces') soldeEspeces += montant;
        else if (r.CanaldePaiement === 'Virement bancaire' || r.CanaldePaiement === 'Chèque') soldeBancaire += montant; // Les chèques sont considérés comme bancaires à l'encaissement
        else if (r.CanaldePaiement === 'Orange Money') soldeOrangeMoney += montant;
        else if (r.CanaldePaiement === 'MTN Mobile Money') soldeMtnMoney += montant;
    });

    expenses.forEach(e => {
        const montant = parseFloat(e.Montant);
        if (isNaN(montant)) return;
        if (e.CanaldePaiement === 'Espèces') soldeEspeces -= montant;
        else if (e.CanaldePaiement === 'Virement bancaire' || e.CanaldePaiement === 'Chèque' || e.CanaldePaiement === 'Carte bancaire') soldeBancaire -= montant;
        else if (e.CanaldePaiement === 'Orange Money') soldeOrangeMoney -= montant;
        else if (e.CanaldePaiement === 'MTN Mobile Money') soldeMtnMoney -= montant;
    });

    soldeTotal = soldeEspeces + soldeBancaire + soldeOrangeMoney + soldeMtnMoney;

    document.getElementById('soldeEspeces').textContent = formatCurrency(soldeEspeces);
    document.getElementById('soldeBancaire').textContent = formatCurrency(soldeBancaire);
    document.getElementById('soldeOrangeMoney').textContent = formatCurrency(soldeOrangeMoney);
    document.getElementById('soldeMtnMoney').textContent = formatCurrency(soldeMtnMoney);
    document.getElementById('soldeTotal').textContent = formatCurrency(soldeTotal);
}

/**
 * Formate un montant en devise CFA.
 * @param {number} amount - Le montant numérique.
 * @returns {string} Le montant formaté.
 */
function formatCurrency(amount) {
    // Utilisation de Intl.NumberFormat pour un formatage localisé
    return `CFA ${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

// Recettes
const receiptForm = document.getElementById('receiptForm');
const receiptMessage = document.getElementById('receiptMessage');
const receiptMemberSelect = document.getElementById('receiptMember');

/**
 * Charge la liste des membres dans la liste déroulante du formulaire de recettes.
 */
async function loadMembersForSelect() {
    const response = await fetchData('getAllMembers');
    if (response.success && response.data) {
        // Vide la liste déroulante et ajoute une option par défaut
        receiptMemberSelect.innerHTML = '<option value="">Sélectionnez un membre</option>'; 
        response.data.forEach(member => {
            // Vérifie que le nom et prénom existent pour éviter les options vides
            if (member.Nom && member.Prénom) {
                const option = document.createElement('option');
                option.value = `${member.Nom} ${member.Prénom}`;
                option.textContent = `${member.Nom} ${member.Prénom}`;
                receiptMemberSelect.appendChild(option);
            }
        });
    } else {
        receiptMemberSelect.innerHTML = '<option value="">Erreur de chargement des membres</option>';
        console.error("Erreur chargement membres:", response.message);
    }
}

// Gère la soumission du formulaire de recettes
receiptForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Empêche le rechargement de la page
    
    // Collecte les données du formulaire
    const data = {
        date: document.getElementById('receiptDate').value,
        membre: document.getElementById('receiptMember').value,
        type: document.getElementById('receiptType').value,
        canal: document.getElementById('receiptCanal').value,
        montant: document.getElementById('receiptAmount').value,
        description: document.getElementById('receiptDescription').value,
    };

    receiptMessage.textContent = 'Enregistrement en cours...';
    receiptMessage.className = 'message'; // Réinitialise le style du message

    const response = await postData('addReceipt', data);
    if (response.success) {
        receiptMessage.textContent = 'Recette enregistrée avec succès !';
        receiptMessage.className = 'message success';
        receiptForm.reset(); // Réinitialise le formulaire
        setDefaultDate('receiptDate'); // Définit la date du jour par défaut
        loadDashboardData(); // Met à jour le tableau de bord après l'ajout
    } else {
        receiptMessage.textContent = 'Erreur: ' + response.message;
        receiptMessage.className = 'message error';
    }
});

// Dépenses
const expenseForm = document.getElementById('expenseForm');
const expenseMessage = document.getElementById('expenseMessage');

// Gère la soumission du formulaire de dépenses
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Empêche le rechargement de la page

    // Collecte les données du formulaire
    const data = {
        date: document.getElementById('expenseDate').value,
        categorie: document.getElementById('expenseCategory').value,
        description: document.getElementById('expenseDescription').value,
        justificatif: document.getElementById('expenseJustificatif').value,
        montant: document.getElementById('expenseAmount').value,
        canal: document.getElementById('expenseCanal').value,
    };

    expenseMessage.textContent = 'Enregistrement en cours...';
    expenseMessage.className = 'message'; // Réinitialise le style du message

    const response = await postData('addExpense', data);
    if (response.success) {
        expenseMessage.textContent = 'Dépense enregistrée avec succès !';
        expenseMessage.className = 'message success';
        expenseForm.reset(); // Réinitialise le formulaire
        setDefaultDate('expenseDate'); // Définit la date du jour par défaut
        loadDashboardData(); // Met à jour le tableau de bord après l'ajout
    } else {
        expenseMessage.textContent = 'Erreur: ' + response.message;
        expenseMessage.className = 'message error';
    }
});

// Historique
const historyTableBody = document.querySelector('#historyTable tbody');
const filterTypeSelect = document.getElementById('filterType');
const filterCanalSelect = document.getElementById('filterCanal');
const applyFilterButton = document.getElementById('applyFilter');
const resetFilterButton = document.getElementById('resetFilter');

/**
 * Charge toutes les transactions (recettes et dépenses) et les affiche dans le tableau historique.
 * Applique les filtres sélectionnés.
 */
async function loadHistoryTable() {
    const receiptsResponse = await fetchData('getReceipts');
    const expensesResponse = await fetchData('getExpenses');

    const receipts = receiptsResponse.success ? receiptsResponse.data : [];
    const expenses = expensesResponse.success ? expensesResponse.data : [];

    let allTransactions = [];

    // Transforme les données de recettes en un format commun
    receipts.forEach(r => {
        // Vérifie si la colonne existe avant d'y accéder
        const description = r.DescriptionCommentaires !== undefined ? r.DescriptionCommentaires : '';
        allTransactions.push({
            date: r.Date,
            type: 'Recette',
            description: description,
            montant: parseFloat(r.Montant),
            canal: r.CanaldePaiement,
            originalType: r.TypedeRecette 
        });
    });

    // Transforme les données de dépenses en un format commun
    expenses.forEach(e => {
        const description = e.DescriptionLibelle !== undefined ? e.DescriptionLibelle : '';
        allTransactions.push({
            date: e.Date,
            type: 'Dépense',
            description: description,
            montant: parseFloat(e.Montant),
            canal: e.CanaldePaiement,
            originalCategory: e.CategoriedeDepense 
        });
    });

    // Trie toutes les transactions par date (la plus ancienne en premier)
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    renderHistoryTable(allTransactions);
}

/**
 * Affiche les transactions filtrées dans le tableau historique.
 * @param {Array<object>} transactions - La liste des transactions à afficher.
 */
function renderHistoryTable(transactions) {
    historyTableBody.innerHTML = ''; // Vide le corps du tableau avant de le remplir

    const filterType = filterTypeSelect.value;
    const filterCanal = filterCanalSelect.value;

    const filteredTransactions = transactions.filter(t => {
        const typeMatch = !filterType || t.type === filterType;
        const canalMatch = !filterCanal || t.canal === filterCanal;
        return typeMatch && canalMatch;
    });

    if (filteredTransactions.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #777;">Aucune transaction trouvée avec les filtres actuels.</td></tr>';
        return;
    }

    filteredTransactions.forEach(t => {
        const row = historyTableBody.insertRow();
        row.insertCell().textContent = new Date(t.date).toLocaleDateString('fr-FR');
        row.insertCell().textContent = t.type;
        row.insertCell().textContent = t.description;
        row.insertCell().textContent = formatCurrency(t.montant);
        row.insertCell().textContent = t.canal;
    });
}

// Ajoute les écouteurs d'événements pour les boutons de filtre
applyFilterButton.addEventListener('click', loadHistoryTable);
resetFilterButton.addEventListener('click', () => {
    filterTypeSelect.value = '';
    filterCanalSelect.value = '';
    loadHistoryTable(); // Recharge le tableau sans filtres
});


// --- Initialisation de l'application ---
// S'exécute lorsque le DOM (la structure HTML) est entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
    // Charge les données du tableau de bord au démarrage
    loadDashboardData();
    // Pré-charge la liste des membres pour le formulaire de recettes (utile si l'utilisateur y va directement)
    loadMembersForSelect();
    // Définit la date par défaut pour les formulaires
    setDefaultDate('receiptDate');
    setDefaultDate('expenseDate');
});

// REMARQUES IMPORTANTES sur les noms de colonnes et Google Apps Script:
// Google Apps Script a une particularité: il retire les espaces et les caractères spéciaux
// des noms d'en-têtes de colonnes lorsqu'il les transforme en clés d'objets JavaScript.
//
// Par exemple:
// "Membre concerné" devient "Membreconcerné"
// "Type de Recette" devient "TypedeRecette"
// "Canal de Paiement" devient "CanaldePaiement"
// "Description / Commentaires" devient "DescriptionCommentaires"
// "Catégorie de Dépense" devient "CategoriedeDepense"
// "Description / Libellé" devient "DescriptionLibelle"
// "Justificatif (Lien)" devient "Justificatif(Lien)" <-- Attention aux parenthèses ici, elles restent souvent.
//
// Assurez-vous que les noms des propriétés utilisées dans les objets JavaScript (ex: r.Montant, e.DescriptionLibelle)
// correspondent à ces versions "sans espace" des en-têtes de colonnes de votre Google Sheet,
// comme utilisé dans le Google Apps Script (getRowData et getSheetData).
// J'ai mis à jour ce fichier main.js pour refléter cela.
