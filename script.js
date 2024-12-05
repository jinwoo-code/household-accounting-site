// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBkWj7sWjpLivK4FqbQyDiN8E4BofBYrUA",
    authDomain: "football-e7071.firebaseapp.com",
    projectId: "football-e7071",
    storageBucket: "football-e7071.appspot.com",
    messagingSenderId: "1025737339448",
    appId: "1:1025737339448:web:d3e052dbbb9b60dbafaccd",
    measurementId: "G-RSCND48DEM"
};

// Firebase 초기화
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentUserDocRef;
let expenseChartInstance; // 차트를 저장할 변수
let currentExpenses = []; // 현재 로드된 지출 내역을 저장할 변수
let currentSortColumn = '';
let currentSortOrder = 'asc';

function setUserName() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserDocRef = db.collection('users').doc(user.uid);
            const userDoc = await currentUserDocRef.get();
            if (userDoc.exists) {
                const userName = userDoc.data().name;
                document.getElementById('userNameNav').innerText = userName;
                loadExpenses();
                loadCategories();
            } else {
                console.log("No such document!");
            }
        } else {
            document.getElementById('userNameNav').innerText = "사용자";
        }
    });
}

setUserName();

document.getElementById('logoutLink').addEventListener('click', function(event) {
    event.preventDefault();
    auth.signOut().then(function() {
        window.location.href = "login.html";
    }).catch(function(error) {
        console.error("Error signing out: ", error);
    });
});

function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = "login.html";
        } else {
            setUserName();
        }
    });
}

window.onload = checkAuthState;

document.getElementById('expenseForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value;
    const amount = document.getElementById('expenseAmount').value;
    const date = document.getElementById('expenseDate').value;

    if (currentUserDocRef) {
        await currentUserDocRef.collection('expenses').add({
            category: category,
            description: description,
            amount: parseFloat(amount),
            date: new Date(date)
        });
        loadExpenses();
    }
});

document.getElementById('expenseCategory').addEventListener('change', (event) => {
    if (event.target.value === 'addCategory') {
        document.getElementById('categoryModal').style.display = 'block';
    }
});

document.getElementById('cancelCategoryButton').addEventListener('click', () => {
    document.getElementById('categoryModal').style.display = 'none';
});

document.getElementById('addCategoryButton').addEventListener('click', () => {
    const newCategory = document.getElementById('newCategory').value.trim();
    if (newCategory) {
        const selectElement = document.getElementById('expenseCategory');
        const existingOption = Array.from(selectElement.options).find(option => option.value === newCategory);
        if (!existingOption) {
            const option = document.createElement('option');
            option.value = newCategory;
            option.textContent = newCategory;
            const addCategoryOption = selectElement.querySelector('option[value="addCategory"]');
            selectElement.insertBefore(option, addCategoryOption);
            selectElement.value = newCategory;
            document.getElementById('categoryModal').style.display = 'none';
            document.getElementById('newCategory').value = '';
        } else {
            alert('이미 존재하는 분류입니다.');
        }
    }
});

function initializeCategorySelect() {
    const categorySelect = document.getElementById('expenseCategory');
    const defaultOptions = `
        <option value="" disabled selected>분류 선택</option>
        <option value="식비">식비</option>
        <option value="고정지출">고정지출</option>
        <option value="옷값">옷값</option>
        <option value="여가">여가</option>
        <option value="기타">기타</option>
        <option value="addCategory">+ 항목 추가</option>`;
    
    // 기본 옵션을 한 번만 추가
    categorySelect.innerHTML = defaultOptions;
}

async function loadExpenses() {
    if (currentUserDocRef) {
        const expenseSnapshot = await currentUserDocRef.collection('expenses').orderBy('date', 'asc').get();
        currentExpenses = expenseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayExpenses(currentExpenses);
    }
}

async function loadCategories() {
    initializeCategorySelect();
}

function displayExpenses(expenses) {
    const view = document.getElementById('viewSelect').value;
    const chartType = document.getElementById('chartTypeSelect').value;
    let filteredExpenses = [];

    const now = new Date();
    let startDate, endDate;
    if (view === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
    } else if (view === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (view === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
    } else if (view === 'day') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 1);
    }

    filteredExpenses = expenses.filter(expense => {
        const expenseDate = expense.date.toDate();
        return expenseDate >= startDate && expenseDate < endDate;
    });

    if (currentSortColumn) {
        filteredExpenses.sort((a, b) => {
            if (a[currentSortColumn] < b[currentSortColumn]) {
                return currentSortOrder === 'asc' ? -1 : 1;
            }
            if (a[currentSortColumn] > b[currentSortColumn]) {
                return currentSortOrder === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    if (chartType === 'date') {
        const labels = filteredExpenses.map(expense => expense.date.toDate().toLocaleDateString());
        const data = filteredExpenses.map(expense => expense.amount);
        updateChart(labels, data, startDate, endDate);
    } else if (chartType === 'category') {
        const categoryTotals = {};
        filteredExpenses.forEach(expense => {
            if (!categoryTotals[expense.category]) {
                categoryTotals[expense.category] = 0;
            }
            categoryTotals[expense.category] += expense.amount;
        });
        const labels = Object.keys(categoryTotals);
        const data = Object.values(categoryTotals);
        updateChart(labels, data, startDate, endDate, '분류별');
    }

    updateTable(filteredExpenses);
}

function updateChart(labels, data, startDate, endDate, chartType = '날짜별') {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const chartFormat = document.getElementById('chartFormatSelect').value;

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    const chartTitle = `${chartType} 지출 내역 (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
    document.getElementById('chartTitle').innerText = chartTitle;

    expenseChartInstance = new Chart(ctx, {
        type: chartFormat,
        data: {
            labels: labels,
            datasets: [{
                label: '지출 내역',
                data: data,
                backgroundColor: chartFormat === 'pie' ? [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(255, 159, 64, 0.2)'
                ] : 'rgba(75, 192, 192, 0.2)',
                borderColor: chartFormat === 'pie' ? [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ] : 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: chartFormat === 'pie' ? {} : {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateTable(expenses) {
    const tableBody = document.getElementById('expenseTableBody');
    tableBody.innerHTML = '';
    expenses.forEach(expense => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${expense.category}</td>
            <td>${expense.date.toDate().toLocaleDateString()}</td>
            <td>${expense.description}</td>
            <td>${expense.amount}</td>
            <td><button onclick="deleteExpense('${expense.id}')">삭제</button></td>
        `;
        tableBody.appendChild(row);
    });
}

async function deleteExpense(expenseId) {
    if (currentUserDocRef) {
        await currentUserDocRef.collection('expenses').doc(expenseId).delete();
        loadExpenses();
    }
}

document.querySelectorAll('th[data-column]').forEach(th => {
    th.addEventListener('click', function() {
        const column = this.getAttribute('data-column');
        if (currentSortColumn === column) {
            currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortOrder = 'asc';
        }
        displayExpenses(currentExpenses);
        updateTableHeaderStyles();
    });
});

function updateTableHeaderStyles() {
    document.querySelectorAll('th[data-column]').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.getAttribute('data-column') === currentSortColumn) {
            th.classList.add(currentSortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
    });
}

function getTodayDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

document.getElementById('viewSelect').addEventListener('change', loadExpenses);
document.getElementById('chartTypeSelect').addEventListener('change', loadExpenses);
document.getElementById('chartFormatSelect').addEventListener('change', loadExpenses);

document.getElementById('expenseDate').value = getTodayDate();

loadExpenses();
initializeCategorySelect();
