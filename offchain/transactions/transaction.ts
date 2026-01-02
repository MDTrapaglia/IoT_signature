import { BlockfrostProvider, MeshWallet, MeshTxBuilder } from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

//console.log(MeshWallet.brew(true))

const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || "")

const wallet = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
	type: "root",
	bech32: process.env.PRIVATE_KEY || ""
    },
});

async function transfer() {
    const walletAddr = await wallet.getChangeAddress();
    //console.log("walletAddr: ", walletAddr)
    const utxos = await wallet.getUtxos()
    console.log("Utxos: ", utxos)
    console.dir(utxos, {depth: null, colors: true})

    const txBuilder = new MeshTxBuilder ({
        fetcher: blockchainProvider,
        verbose: false
    })
    
    const unsignedTx = await txBuilder
        .txOut(
            walletAddr,
            [{ unit: "lovelace", quantity: "1000000"}]
        )
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx)

    //const txHash = await wallet.submitTx(signedTx)
    //console.log("txHash: ", txHash)
}
transfer()
console.log("Ready")
