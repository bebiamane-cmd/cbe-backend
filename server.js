const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Render Environment Variables irraa icciitii dubbisuu
const accountSid = process.env.TWILIO_ACCOUNT_SID; 
const authToken = process.env.TWILIO_AUTH_TOKEN;   
const twilioNumber = process.env.TWILIO_PHONE_NUMBER; 

const client = require('twilio')(accountSid, authToken);

let cbeAccountsDatabase = {
    "+251956905755": { 
        name: "ABDURAZAK HUSSEN GELATO", 
        accountNumber: "1000293849502", 
        balance: 100000000.00 
    },
    "activeOtps": {} 
};

async function sendProductionSMS(toPhoneNumber, messageBody) {
    let cleanPhone = toPhoneNumber.trim();
    if (cleanPhone.startsWith('0')) {
        cleanPhone = "+251" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('+')) {
        cleanPhone = "+" + cleanPhone;
    }

    try {
        await client.messages.create({
            body: messageBody,
            from: twilioNumber,
            to: cleanPhone
        });
        return true;
    } catch (error) {
        console.error("❌ SMS Execution Failed:", error.message);
        return false;
    }
}

app.post('/api/bank/request-otp', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "Lakk. bilbilaa barbaachisaadha" });

    let secureOtp = Math.floor(100000 + Math.random() * 900000);
    cbeAccountsDatabase.activeOtps[phoneNumber] = secureOtp;
    
    let smsText = `[CBE Mobile Banking] Koodiin icciitii verification keessan: ${secureOtp} dha. Maaloo nama biraatti hin laatamaa. (CBEMTA)`;
    let isSent = await sendProductionSMS(phoneNumber, smsText);
    
    if (isSent) res.json({ success: true });
    else res.status(500).json({ error: "Twilio Gateway integration failure." });
});

app.post('/api/bank/verify-otp', (req, res) => {
    const { otp, phoneNumber } = req.body;
    let savedOtp = cbeAccountsDatabase.activeOtps[phoneNumber];

    if (savedOtp && otp == savedOtp) {
        delete cbeAccountsDatabase.activeOtps[phoneNumber];
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "OTP configuration mismatch." });
    }
});

app.post('/api/bank/transfer', async (req, res) => {
    const { senderPhone, receiverPhone, receiverAccount, amount } = req.body;
    let sender = cbeAccountsDatabase[senderPhone];

    if (!sender || sender.balance < amount) {
        return res.status(400).json({ error: "Maallaqa gahaa hin qabdan!" });
    }

    sender.balance -= amount;

    let senderSms = `CBE-Alert: Debited ETB ${amount.toLocaleString()} gara herrega CBE ${receiverAccount} tti ergameera. Hafteen keessan: ETB ${sender.balance.toLocaleString()}. (CBEMTA)`;
    await sendProductionSMS(senderPhone, senderSms);
    
    let receiverSms = `CBE-Alert: Credited! Herrega keessan irratti kaffaltii ETB ${amount.toLocaleString()} ABDURAZAK HUSSEN GELATO irraa dhufeera. Waasoo Baankii keenyaaf galatoomaa.`;
    if (receiverPhone) {
        await sendProductionSMS(receiverPhone, receiverSms);
    }

    res.json({ success: true, newBalance: sender.balance });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
