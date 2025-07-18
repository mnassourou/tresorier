// Fichier: main.js

// !!! IMPORTANT: Remplacez cette URL par l'URL de votre application web Google Apps Script que vous avez copiée !!!
const SCRIPT_WEB_APP_URL = 'VOTRE_URL_DE_L_APPLICATION_WEB_GOOGLE_APPS_SCRIPT';

// --- Fonctions utilitaires pour interagir avec le Google Apps Script ---
async function fetchData(action, params = {}) {
    const url = new URL(SCRIPT_WEB_APP_URL);
    url.searchParams.append('action', action);
    for (const key in params) {
        url.searchParams.append(key, params[key]);
    }

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
        return { success: false, message: "Erreur de connexion aux serveurs: " + error.message };
    }
}

async function postData(action, data) {
    const url = new URL(SCRIPT_WEB_APP_URL);
    url.searchParams.append('action', action);

    // Convertir les dates au format YYYY-MM-DD
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
        });
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Erreur lors de l'envoi des données:", error);
        return { success: false, message: "Erreur de connexion aux serveurs: " + error.message };
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

        // Charger les données spécifiques à l'onglet lors de l'activation
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
    document.getElementById(elementId).value = today;
}

// --- Fonctionnalités spécifiques à chaque onglet ---

// Dashboard
async function loadDashboardData() {
    const receipts = (await fetchData('getReceipts')).data || [];
    const expenses = (await fetchData('getExpenses')).data || [];

    let soldeEspeces = 0;
    let soldeBancaire = 0;
    let soldeOrangeMoney = 0;
    let soldeMtnMoney = 0;
    let soldeTotal = 0;

    // Calcul des soldes (simplifié pour le tableau de bord, vous avez des calculs plus précis dans Google Sheet)
    receipts.forEach(r => {
        const montant = parseFloat(r.Montant);
        if (isNaN(montant)) return;
        if (r.CanaldePaiement === 'Espèces') soldeEspeces += montant;
        else if (r.CanaldePaiement === 'Virement bancaire') soldeBancaire += montant;
        else if (r.CanaldePaiement === 'Orange Money') soldeOrangeMoney += montant;
        else if (r.CanaldePaiement === 'MTN Mobile Money') soldeMtnMoney += montant;
    });

    expenses.forEach(e => {
        const montant = parseFloat(e.Montant);
        if (isNaN(montant)) return;
        if (e.CanaldePaiement === 'Espèces') soldeEspeces -= montant;
        else if (e.CanaldePaiement === 'Virement bancaire') soldeBancaire -= montant;
        else if (e.CanaldePaiement === 'Chèque' || e.CanaldePaiement === 'Carte bancaire') soldeBancaire -= montant; // Assumer que Chèque/Carte impactent le compte bancaire
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
    return `CFA ${new Intl.NumberFormat('fr-FR').format(amount)}`;
}

// Recettes
const receiptForm = document.getElementById('receiptForm');
const receiptMessage = document.getElementById('receiptMessage');
const receiptMemberSelect = document.getElementById('receiptMember');

async function loadMembersForSelect() {
    const response = await fetchData('getAllMembers');
    if (response.success && response.data) {
        receiptMemberSelect.innerHTML = '<option value="">Sélectionnez un membre</option>'; // Réinitialiser
        response.data.forEach(member => {
            const option = document.createElement('option');
            option.value = `${member.Nom} ${member.Prénom}`;
            option.textContent = `${member.Nom} ${member.Prénom}`;
            receiptMemberSelect.appendChild(option);
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
    receiptMessage.className = 'message'; // Réinitialiser le style

    const response = await postData('addReceipt', data);
    if (response.success) {
        receiptMessage.textContent = 'Recette enregistrée avec succès !';
        receiptMessage.className = 'message success';
        receiptForm.reset();
        setDefaultDate('receiptDate');
        loadDashboardData(); // Mettre à jour le tableau de bord
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
    expenseMessage.className = 'message'; // Réinitialiser le style

    const response = await postData('addExpense', data);
    if (response.success) {
        expenseMessage.textContent = 'Dépense enregistrée avec succès !';
        expenseMessage.className = 'message success';
        expenseForm.reset();
        setDefaultDate('expenseDate');
        loadDashboardData(); // Mettre à jour le tableau de bord
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
    const receipts = (await fetchData('getReceipts')).data || [];
    const expenses = (await fetchData('getExpenses')).data || [];

    let allTransactions = [];

    receipts.forEach(r => {
        allTransactions.push({
            date: r.Date,
            type: 'Recette',
            description: r.DescriptionCommentaires, // Attention aux noms de colonnes du script Apps Script
            montant: parseFloat(r.Montant),
            canal: r.CanaldePaiement,
            originalType: r.TypedeRecette // Pour filtrage futur si besoin
        });
    });

    expenses.forEach(e => {
        allTransactions.push({
            date: e.Date,
            type: 'Dépense',
            description: e.DescriptionLibelle, // Attention aux noms de colonnes du script Apps Script
            montant: parseFloat(e.Montant),
            canal: e.CanaldePaiement,
            originalCategory: e.CategoriedeDepense // Pour filtrage futur si besoin
        });
    });

    // Trier toutes les transactions par date
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    renderHistoryTable(allTransactions);
}


function renderHistoryTable(transactions) {
    historyTableBody.innerHTML = ''; // Vider le tableau existant

    const filteredTransactions = transactions.filter(t => {
        const typeMatch = !filterTypeSelect.value || t.type === filterTypeSelect.value;
        const canalMatch = !filterCanalSelect.value || t.canal === filterCanalSelect.value;
        return typeMatch && canalMatch;
    });

    if (filteredTransactions.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucune transaction trouvée.</td></tr>';
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


// --- Initialisation ---
document.addEventListener('DOMContentLoaded', () => {
    // Charger le tableau de bord au démarrage
    loadDashboardData();
    // Charger les membres pour le formulaire de recettes (il est masqué au début mais on précharge)
    loadMembersForSelect();
    // Définir la date par défaut
    setDefaultDate('receiptDate');
    setDefaultDate('expenseDate');
});

// IMPORTANT: Le script Google Apps remplace les espaces dans les noms de colonnes par ''
// Recettes: Date, Membre concerné, Type de Recette, Canal de Paiement, Montant, Description / Commentaires
// Deviennent: Date, Membreconcerné, Typederecette, CanaldePaiement, Montant, DescriptionCommentaires

// Dépenses: Date, Catégorie de Dépense, Description / Libellé, Justificatif (Lien), Montant, Canal de Paiement
// Deviennent: Date, CategoriedeDepense, DescriptionLibelle, Justificatif(Lien), Montant, CanaldePaiement
