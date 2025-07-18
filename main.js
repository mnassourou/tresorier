// Fichier: main.js (Version Complète & Corrigée)

// !!! IMPORTANT: Remplacez cette URL par l'URL de votre application web Google Apps Script que vous avez copiée !!!
// Cette URL commence par 'https://script.google.com/macros/s/...'
const SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxHRGkI0jSjE9zwlSyuMqZhRpg4tH01UcqdiqpfAR-GZJj0B2f62Q10A92h1_Xw41En9w/exec'; // URL corrigée


// --- Fonctions utilitaires pour interagir avec le Google Apps Script ---

/**
 * Effectue une requête GET vers l'API Apps Script.
 * @param {string} action - L'action à effectuer sur l'API.
 * @param {object} params - Les paramètres à envoyer avec la requête.
 * @returns {Promise<object>} Une promesse qui résout avec les données de la réponse.
 */
async function fetchData(action, params = {}) {
    const url = new URL(SCRIPT_WEB_APP_URL);
    url.searchParams.append('action', action);
    for (const key in params) {
        url.searchParams.append(key, params[key]);
    }

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors', // Crucial pour les requêtes cross-origin
            credentials: 'omit' // Ne pas envoyer de cookies/credentials
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}. Réponse: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
        return { success: false, message: "Erreur de connexion aux serveurs ou API: " + error.message };
    }
}

/**
 * Effectue une requête POST vers l'API Apps Script.
 * @param {string} action - L'action à effectuer sur l'API.
 * @param {object} data - Les données à envoyer avec la requête.
 * @returns {Promise<object>} Une promesse qui résout avec les données de la réponse.
 */
async function postData(action, data) {
    const url = new URL(SCRIPT_WEB_APP_URL);
    url.searchParams.append('action', action);

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
            mode: 'cors',
            credentials: 'omit'
        });

        if (!response.ok) {
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

        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(tabId).classList.add('active');

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

function setDefaultDate(elementId) {
    const today = new Date().toISOString().split('T')[0];
    const element = document.getElementById(elementId);
    if (element) {
        element.value = today;
    }
}

// --- Fonctionnalités spécifiques à chaque onglet ---

// Tableau de Bord
async function loadDashboardData() {
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
        else if (r.CanaldePaiement === 'Virement bancaire' || r.CanaldePaiement === 'Chèque') soldeBancaire += montant;
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

function formatCurrency(amount) {
    return `CFA ${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

// Recettes
const receiptForm = document.getElementById('receiptForm');
const receiptMessage = document.getElementById('receiptMessage');
const receiptMemberSelect = document.getElementById('receiptMember');

async function loadMembersForSelect() {
    const response = await fetchData('getAllMembers');
    if (response.success && response.data) {
        receiptMemberSelect.innerHTML = '<option value="">Sélectionnez un membre</option>';
        response.data.forEach(member => {
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

receiptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        date: document.getElementById('receiptDate').value,
        membre: document.getElementById('receiptMember').value,
        type: document.getElementById('receiptType').value,
        canal: document.getElementById('receiptCanal').value,
        montant: document.getElementById('receiptAmount').value,
        description: document.getElementById('receiptDescription').value,
    };

    receiptMessage.textContent = 'Enregistrement en cours...';
    receiptMessage.className = 'message';

    const response = await postData('addReceipt', data);
    if (response.success) {
        receiptMessage.textContent = 'Recette enregistrée avec succès !';
        receiptMessage.className = 'message success';
        receiptForm.reset();
        setDefaultDate('receiptDate');
        loadDashboardData();
    } else {
        receiptMessage.textContent = 'Erreur: ' + response.message;
        receiptMessage.className = 'message error';
    }
});

// Dépenses
const expenseForm = document.getElementById('expenseForm');
const expenseMessage = document.getElementById('expenseMessage');

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        date: document.getElementById('expenseDate').value,
        categorie: document.getElementById('expenseCategory').value,
        description: document.getElementById('expenseDescription').value,
        justificatif: document.getElementById('expenseJustificatif').value,
        montant: document.getElementById('expenseAmount').value,
        canal: document.getElementById('expenseCanal').value,
    };

    expenseMessage.textContent = 'Enregistrement en cours...';
    expenseMessage.className = 'message';

    const response = await postData('addExpense', data);
    if (response.success) {
        expenseMessage.textContent = 'Dépense enregistrée avec succès !';
        expenseMessage.className = 'message success';
        expenseForm.reset();
        setDefaultDate('expenseDate');
        loadDashboardData();
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

async function loadHistoryTable() {
    const receiptsResponse = await fetchData('getReceipts');
    const expensesResponse = await fetchData('getExpenses');

    const receipts = receiptsResponse.success ? receiptsResponse.data : [];
    const expenses = expensesResponse.success ? expensesResponse.data : [];

    let allTransactions = [];

    receipts.forEach(r => {
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

    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    renderHistoryTable(allTransactions);
}

function renderHistoryTable(transactions) {
    historyTableBody.innerHTML = '';

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

applyFilterButton.addEventListener('click', loadHistoryTable);
resetFilterButton.addEventListener('click', () => {
    filterTypeSelect.value = '';
    filterCanalSelect.value = '';
    loadHistoryTable();
});


// --- Initialisation de l'application ---
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    loadMembersForSelect();
    setDefaultDate('receiptDate');
    setDefaultDate('expenseDate');
});

// Rappel IMPORTANT sur les noms de colonnes et Google Apps Script:
// Google Apps Script a une particularité: il retire les espaces et les caractères spéciaux
// des noms d'en-têtes de colonnes lorsqu'il les transforme en clés d'objets JavaScript.
// Exemple: "Membre concerné" devient "Membreconcerné".
// J'ai mis à jour le Code.gs pour mieux gérer cette transformation, mais vérifiez toujours.
