import express from 'express';
import bodyParser from 'body-parser';
import StellarSdk from 'stellar-sdk';
import crypto from 'crypto';
import dotenv from 'dotenv';
import request from 'request'

dotenv.config();
const app = express();


app.use(bodyParser.json());

const API_KEY = process.env.API_KEY;
const CLIC_URL = "https://api.clic.world/banking/v3/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ISSUER_PUBLIC_KEY = process.env.ISSUER_PUBLIC_KEY;
const API_SECRET = process.env.API_SECRET;

const server = new StellarSdk.Server('https://horizon.stellar.org');

app.post('/', initPayment);

async function initPayment(req, res) {
    const { request_id, wallet_id, amount, currency } = req.body;
    console.log("Received transfer request, ", req.body)

    try {
        const pbKey = await getClicAccount(wallet_id);
        if (!pbKey) {
            return res.status(500).json({ error: 'Account not found' });
        }

        if (request_id.length > 28) {
            request_id = "abc_clic"
        }

        const signatureEnvelopeResult = await generateSignatureEnvelope(amount, currency, pbKey, request_id);
        const calculatedSignature = generateSignature(req.body);

        const payLoad = {
            "paymode": "bank",
            "request_id": request_id,
            "wallet_id": wallet_id,
            "amount": amount,
            "currency": currency,
            "envelope": signatureEnvelopeResult,
            "signature": calculatedSignature
        };

        const initPaymentResult = await sendPostData("wallet/depositRequest", payLoad);
        const response = JSON.parse(initPaymentResult);
        if (response.status == 100) {
            return res.status(200).send(initPaymentResult);
        } else {
            return res.status(403).send(initPaymentResult);
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function getClicAccount(wallet_id) {
    console.log("Validating Clic Account", wallet_id)
    const raw = {
        "username": wallet_id
    };

    const response = await sendPostData("accounts/getclicusername", raw);
    const kson = JSON.parse(response)
    if (kson.status == 100) {
        console.log("Account validated, public key is ", kson.public_key)
        return kson.public_key;
    } else {
        console.log("Account validation failed")
        return kson.status;
    }
}

function generateSignature(requestBody) {
    const { request_id, paymode, wallet_id, amount, currency } = requestBody;
    const dataToSign = paymode + request_id + wallet_id + wallet_id + amount + currency + API_SECRET;

    const sha256Hash = crypto.createHash('sha256').update(dataToSign).digest('hex');
    const signature = Buffer.from(sha256Hash).toString('base64');
    console.log("sha256Hash", signature)
    return signature;

}

async function generateSignatureEnvelope(amount, assetCode, destination, request_id) {
    try {
        console.log("Generating transaction envelope with data ", { amount, assetCode, destination, request_id })
        const asset = new StellarSdk.Asset(
            assetCode,
            ISSUER_PUBLIC_KEY,
        );
        const fees = 1000000; // Set the desired fee value


        const signingSecretKey = PRIVATE_KEY;
        const signingKeypair = StellarSdk.Keypair.fromSecret(signingSecretKey);

        const signingAccount = await server.loadAccount(signingKeypair.publicKey());

        const transaction = new StellarSdk.TransactionBuilder(signingAccount, {
            fee: String(fees),
            networkPassphrase: StellarSdk.Networks.PUBLIC
        })



            .addOperation(StellarSdk.Operation.payment({
                destination: destination,
                asset: asset,
                amount: String(amount)
            }))
            .setTimeout(10000)
            .addMemo(StellarSdk.Memo.text(request_id))
            .build();

        transaction.sign(signingKeypair);

        const envelopeXDR = transaction.toEnvelope().toXDR('base64');
        console.log("Transaction envelope generated\n ", envelopeXDR)
        return envelopeXDR;
    } catch (error) {
        console.error('Error generating signature envelope:', error);
        return null;
    }
}


async function sendPostData(subUrl, data) {
    try {
        console.log("Sending request to clic service")
        const url = CLIC_URL + subUrl;

        const options = {
            method: 'POST',
            url: url,
            headers: {
                'API-KEY': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

        return new Promise((resolve, reject) => {
            request(options, function (error, response, body) {
                if (error) {
                    console.error('Error getting to CLIC:', error);
                    reject(error);
                } else {
                    console.log("Transaction response from clic ", body);
                    resolve(body);
                }
            });
        });
    } catch (error) {
        console.error('Error sending request to clic server :', error);
        return null;
    }
}


app.listen(process.env.PORT, () => {
    console.log('CLIC-ABC MULTI Signer service is running on port ' + process.env.PORT);
    console.log(`Send POST requests for http://127.0.0.1:${process.env.PORT}`)
});
