// main.js - Shared functions
async function logoutUser() {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard: ' + text);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function showAccountDetailsReceipt() {
    const holderName = document.getElementById('accountHolderName')?.textContent || 'N/A';
    const accountNumber = document.getElementById('fullAccountNumber')?.textContent || 'N/A';
    const sortCode = document.getElementById('fullSortCode')?.textContent || 'N/A';
    const iban = document.getElementById('ibanNumber')?.textContent || 'N/A';
    const swift = document.getElementById('swiftCode')?.textContent || 'N/A';
    const balance = document.getElementById('currentBalance')?.textContent || '0.00';
    
    const receiptHTML = `
        <div id="receiptModal" class="modal-overlay">
            <div class="modal" style="max-width: 500px;">
                <h3>Account Details Receipt</h3>
                <div class="receipt-content">
                    <div class="receipt-header">
                        <h4>Barclays Bank</h4>
                        <p>Date: ${new Date().toLocaleDateString()}</p>
                    </div>
                    <hr>
                    <div class="receipt-details">
                        <p><strong>Account Holder:</strong> ${holderName}</p>
                        <p><strong>Account Number:</strong> ${accountNumber}</p>
                        <p><strong>Sort Code:</strong> ${sortCode}</p>
                        <p><strong>IBAN:</strong> ${iban}</p>
                        <p><strong>SWIFT/BIC:</strong> ${swift}</p>
                        <p><strong>Available Balance:</strong> £${balance}</p>
                    </div>
                    <hr>
                    <div class="receipt-footer">
                        <p>This is an official receipt of your account details.</p>
                        <p>Keep this information secure.</p>
                        <p>Branch: 1 Churchill Place, London E14 5HP</p>
                    </div>
                </div>
                <div class="button-group" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="printReceipt()">Print Receipt</button>
                    <button class="btn btn-secondary" onclick="closeReceipt()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('receiptModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', receiptHTML);
}

function printReceipt() {
    const printContent = document.querySelector('#receiptModal .modal').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    
    // Re-add event listeners
    window.location.reload();
}

function closeReceipt() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.remove();
}

async function requestATMCard() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        const cardRequestHTML = `
            <div id="atmCardModal" class="modal-overlay">
                <div class="modal" style="max-width: 500px;">
                    <h3>ATM Card Request</h3>
                    <div class="form-group">
                        <p>Request a new ATM card for your account:</p>
                        <p><strong>Account:</strong> ${userData.accountNumber}</p>
                        <p><strong>Current Card:</strong> **** **** **** ${userData.cardNumber?.slice(-4) || 'N/A'}</p>
                    </div>
                    <div class="form-group">
                        <label>Delivery Address</label>
                        <textarea id="deliveryAddress" rows="3" placeholder="Enter your delivery address" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Card Type</label>
                        <select id="cardType">
                            <option value="standard">Standard Debit Card</option>
                            <option value="contactless">Contactless Debit Card</option>
                            <option value="premium">Premium Card</option>
                        </select>
                    </div>
                    <div id="atmCardAlert" class="alert" style="display: none;"></div>
                    <div class="button-group">
                        <button class="btn btn-primary" onclick="submitATMCardRequest()">Submit Request</button>
                        <button class="btn btn-secondary" onclick="hideModal('atmCardModal')">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if present
        const existingModal = document.getElementById('atmCardModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', cardRequestHTML);
        
    } catch (error) {
        console.error('Error requesting ATM card:', error);
        alert('Error loading account details');
    }
}

async function submitATMCardRequest() {
    const user = auth.currentUser;
    if (!user) return;
    
    const deliveryAddress = document.getElementById('deliveryAddress').value;
    const cardType = document.getElementById('cardType').value;
    
    if (!deliveryAddress) {
        showAlert('atmCardAlert', 'Please enter delivery address', 'error');
        return;
    }
    
    try {
        // Generate new card number
        const newCardNumber = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
        
        // Update user's card number
        await db.collection('users').doc(user.uid).update({
            cardNumber: newCardNumber,
            cardType: cardType,
            cardRequestDate: firebase.firestore.FieldValue.serverTimestamp(),
            cardDeliveryAddress: deliveryAddress,
            cardStatus: 'requested'
        });
        
        // Add transaction record
        const transaction = {
            date: new Date().toISOString(),
            description: 'ATM Card Request - New Card Issued',
            amount: 0,
            balance: await getCurrentBalance(user.uid),
            type: 'card_request',
            reference: 'CARD_REPLACEMENT',
            processedBy: 'system'
        };
        
        await db.collection('users').doc(user.uid).update({
            transactions: firebase.firestore.FieldValue.arrayUnion(transaction)
        });
        
        showAlert('atmCardAlert', 'ATM card request submitted successfully! New card will be dispatched within 5-7 working days.', 'success');
        
        setTimeout(() => {
            hideModal('atmCardModal');
            if (window.location.pathname.includes('dashboard.html')) {
                loadDashboardData();
            }
        }, 3000);
        
    } catch (error) {
        showAlert('atmCardAlert', 'Error submitting request: ' + error.message, 'error');
    }
}

async function getCurrentBalance(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        return userDoc.data().balance || 0;
    } catch (error) {
        return 0;
    }
}

async function showWithdrawModal() {
    const modalHTML = `
        <div id="withdrawModal" class="modal-overlay">
            <div class="modal">
                <h3>Withdraw Money</h3>
                <div class="form-group">
                    <label>Amount (£)</label>
                    <input type="number" id="withdrawAmount" min="0.01" step="0.01" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Description (Optional)</label>
                    <input type="text" id="withdrawDescription" placeholder="e.g., Cash withdrawal">
                </div>
                <div id="withdrawAlert" class="alert" style="display: none;"></div>
                <div class="button-group">
                    <button class="btn btn-primary" onclick="processWithdrawal()">Withdraw</button>
                    <button class="btn btn-secondary" onclick="hideModal('withdrawModal')">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('withdrawModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function processWithdrawal() {
    const user = auth.currentUser;
    if (!user) return;
    
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const description = document.getElementById('withdrawDescription').value || 'Cash withdrawal';
    
    if (!amount || amount <= 0) {
        showAlert('withdrawAlert', 'Please enter a valid amount', 'error');
        return;
    }
    
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        const currentBalance = userData.balance || 0;
        
        if (amount > currentBalance) {
            showAlert('withdrawAlert', 'Insufficient funds', 'error');
            return;
        }
        
        const newBalance = currentBalance - amount;
        
        // Update balance
        await db.collection('users').doc(user.uid).update({
            balance: newBalance
        });
        
        // Add transaction
        const transaction = {
            date: new Date().toISOString(),
            description: description,
            amount: -amount,
            balance: newBalance,
            type: 'debit',
            reference: 'WITHDRAWAL',
            processedBy: 'self'
        };
        
        await db.collection('users').doc(user.uid).update({
            transactions: firebase.firestore.FieldValue.arrayUnion(transaction)
        });
        
        showAlert('withdrawAlert', `Withdrawal successful! £${amount.toFixed(2)} withdrawn. New balance: £${newBalance.toFixed(2)}`, 'success');
        
        setTimeout(() => {
            hideModal('withdrawModal');
            if (window.location.pathname.includes('dashboard.html')) {
                loadDashboardData();
            }
        }, 2000);
        
    } catch (error) {
        showAlert('withdrawAlert', 'Error processing withdrawal: ' + error.message, 'error');
    }
}