
import express, { json } from 'express';
import { Server, Keypair, Asset, TransactionBuilder, Networks, Operation } from "stellar-sdk";
import cors from 'cors';
import * as dotenv from 'dotenv'
dotenv.config()

var app = express()
app.use(cors())
app.use(json());


const server = new Server(process.env.SERVER);
const assetCode = process.env.CURRENCY
const assetIssuer = process.env.ISSUER
const signerKey = process.env.PRIVATE_KEY


app.post('/getXdr', generateXDR)

app.get('/', init)

async function init(req, res) {
    return makeResponse(res, "not allowed here", 401)
}

async function generateXDR(req, res) {
    try {
        const amount = request.amount.toString();
        const memo = request.txHash
        if (memo.length > 28) {
            return makeResponse(res, "Memo must be less than 28 characters", 401)
        }
        const senderKeypair = Keypair.fromSecret(signerKey)
        const sendingAsset = new Asset(assetCode, assetIssuer);

        console.log(
            `Making a new payment of  ${amount} ${assetCode} to ${destination}`);

        const [
            {
                max_fee: { mode: fee },
            },
            sender,
        ] = await Promise.all([
            server.feeStats(),
            server.loadAccount(senderKeypair.publicKey()),
        ]);

        const transaction = new TransactionBuilder(sender, {
            fee,
            networkPassphrase: Networks.PUBLIC,
        })
            .addOperation(
                Operation.payment({
                    destination,
                    asset: sendingAsset,
                    amount,
                }),
            )
            .addMemo(StellarSdk.Memo.text(memo))
            .setTimeout(300)
            .build();
        const xdr = transaction.toEnvelope().toXDR('base64');
        return makeResponse(xdr, 100);
    } catch (error) {
        console.log("error", error)
        return makeResponse(res, "Unexpected error", 203)
    }

}

async function makeResponse(res, response, status) {
    res.status(status).send(response)
}

var _server = app.listen(process.env.PORT, function () {
    var host = _server.address().address
    var port = _server.address().port
    console.log("App listening at http://%s:%s", host, port)
})