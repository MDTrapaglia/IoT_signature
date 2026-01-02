import { BlockfrostProvider, MeshWallet, MeshTxBuilder, applyParamsToScript, applyCborEncoding, resolveScriptHash, stringToHex, type PlutusScript, mConStr0 } from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

//console.log(MeshWallet.brew(true))

const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || "")

const txBuilder = new MeshTxBuilder ({
    fetcher: blockchainProvider,
    verbose: false
})

const wallet = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
	type: "root",
	bech32: process.env.PRIVATE_KEY || ""
    },
});

const nft_code =
      "5901110101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa00189991192cc004c038006264b30013370e90011bad300c0018acc004c8cc004004dd61807802112cc00400629422b30013375e6020601c6ea8c04000405229462660040046022002806100f44cdc79bae300b0010098a504029164028601a0031640306464660020026eacc038c03cc03cc03cc03c00c896600200300389919912cc004cdc8804001456600266e3c02000a20030064039133005005301300440386eb8c034004dd598070009807800a01c14bd6f7b6301bae300a3008375400260106ea8c0280122c8030c020004c020c024004c020004c010dd5004452689b2b20041"

async function mintNFTTransaction(
    wallet: MeshWallet,
    token_name: string
): Promise<string> {
    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();
    const ownerUtxo = utxos.filter(
        (utxo) => !collateral.includes(utxo)
    )[0];

    if (!ownerUtxo || !collateral[0])
        throw new Error("not enough UTXOs or collateral");

    const codeWithParams = applyParamsToScript(
        applyCborEncoding(nft_code),
        [
            mConStr0([ownerUtxo.input.txHash, ownerUtxo.input.outputIndex]),
            token_name
        ]
    );
    
    const mintingPolicy = resolveScriptHash(codeWithParams, "V3");
    const tokenNameHex = stringToHex(token_name);
    const nftScript : PlutusScript = {
        code: codeWithParams,
        version: "V3",
    };

    const unsignedTx = await txBuilder
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .mintPlutusScriptV3()
        .mint("1", mintingPolicy, tokenNameHex)
        .mintRedeemerValue(mConStr0([]))
        .mintingScript(nftScript.code)
        .txInCollateral(collateral[0].input.txHash, collateral[0]?.input.outputIndex)
        .txIn(ownerUtxo?.input.txHash, ownerUtxo?.input.outputIndex)
        .complete();

        // .txOut(
        //     walletAddr,
        //     [{ unit: "lovelace", quantity: "1000000"}]
        // )
    const signedTx = await wallet.signTx(unsignedTx)
    const txHash = await wallet.submitTx(signedTx)
    console.log("txHash: ", txHash)
    return txHash;
}

async function _transfer() {
    const walletAddr = await wallet.getChangeAddress();
    //console.log("walletAddr: ", walletAddr)
    const utxos = await wallet.getUtxos()
    console.log("Utxos: ", utxos)
    console.dir(utxos, {depth: null, colors: true})


    const unsignedTx = await txBuilder
        .txOut(
            walletAddr,
            [{ unit: "lovelace", quantity: "1000000"}]
        )
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete()

    const _signedTx = await wallet.signTx(unsignedTx)

    //const txHash = await wallet.submitTx(_signedTx)
    //console.log("txHash: ", txHash)
}
// _transfer()
mintNFTTransaction(wallet, "BigThingsAreComing")
console.log("Ready")
