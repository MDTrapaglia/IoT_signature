import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyParamsToScript,
    applyCborEncoding,
    type PlutusScript,
    mConStr0,
    serializePlutusScript,
    deserializeAddress
} from "@meshsdk/core"
import dotenv from "dotenv"
import nacl from "tweetnacl"
dotenv.config()

// Código compilado del validador sensor_oracle_ed25519 desde plutus.json
export const oracle_validator_code = "590491010100229800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e264664530011325980099199119801001000912cc00400629422b30013371e6eb8c04c00400e2946266004004602800280710111bac301130123012301230123012301230123012300e375400c6eb8c004c034dd5009c566002600460186ea8022264b30013003300d375400313322598009804cc004dd5980218081baa300430103754005375c602660206ea8c04cc040dd500b4dd7180218081baa30133010375402c800a26464b300130160018992cc004c03260026eacc01cc04cdd5000cdd7180b18099baa301630133754033375c600e60266ea8c058c04cdd500ca0088acc004c8c9660026014003168acc004c0380062d132598009805980a9baa00189919191919194c004dd7180f800cdd7180f8034dd6980f802cdd6980f8024dd6980f801cdd7180f8012444444b300130260078cc0048c098c09cc09cc09cc09cc09c0064604c604e604e604e604e00323026302730273027001488966002b30015980099b894839c1cdd6980c98129baa010899b89375a6032604a6ea804120d00f8a50408d159800acc004cdc4a40006eb4c054c094dd500844cdc49bad301530253754020906807c52820468acc004cdc4240006eb4c004c094dd5008456600266e1cdc69bae300230253754020904000c56600266e1cdc69bae3003302537540209020456600266e212000371a6eb8c0a0c094dd50084528c5902345902345902345902345902345902345660033001375c6006604a6ea804266e28cdc519b8a9800a51a4021375a602a604a6ea8041792375c6050604a6ea8042600294690084dd6980c98129baa0105e4a600294690084dd6980098129baa0105e4a6eb8c008c094dd50082e5514a316408d16408c8b2046180f800980f000980e800980e000980d800980b1baa0018b2028301830153754004809901318099baa00130033013375400314a3164045164044602a00316404c64660020026eb0c008c048dd5005112cc004006297ae0899912cc004cdd7980c180a9baa0023018301537546012602a6ea801e26602e00466008008003133004004001404c602c002602e00280a08c050c054c0540062c8070c044c038dd500091119199119801001000912cc00400600713233225980099b910070028acc004cdc78038014400600c80aa26600a00a603600880a8dd7180a0009bad30150013017001405464646600200200c44b3001001801c4c8cc896600266e4402400a2b30013371e0120051001803202c899802802980e002202c375c602a0026eacc058004c0600050160a5eb7bdb180520008b2018323300100137586022601c6ea8018896600200314c0103d87a80008992cc004cdd7980998081baa001006899ba548000cc0480052f5c11330030033014002403860240028082294500b45900b118081808800cc02cdd5003cc03cc04000d2225980098020014566002601e6ea802a00716404115980098040014566002601e6ea802a0071640411640348068601a0026e1d20003009375400716401c300800130033754011149a26cac80081"

// Tipos para los datos del sensor
export interface SensorData {
    sensor_id: string;
    temperature: number;  // Temperatura * 10 (ej: 23.5°C = 235)
    humidity: number;     // Humedad * 10 (ej: 65.2% = 652)
    timestamp: number;    // Unix timestamp en milisegundos
    signature: string;    // Firma Ed25519 (64 bytes hex = 128 chars)
    public_key: string;   // Clave pública Ed25519 (32 bytes hex = 64 chars)
}

// Parámetros para updateOracle
export interface UpdateOracleParams {
    blockfrostApiKey: string;
    privateKey: string;
    networkId: number;
    nftPolicyId: string;
    nftAssetName: string;
    sensorData: SensorData;
}

/// Construye el mensaje binario que será firmado
/// Orden alfabético: humidity || sensor_id || temperature || timestamp
/// Los enteros se codifican como 8 bytes big-endian
export function buildMessage(data: SensorData): Buffer {
    const humidityBytes = Buffer.alloc(8);
    humidityBytes.writeBigInt64BE(BigInt(data.humidity));

    const temperatureBytes = Buffer.alloc(8);
    temperatureBytes.writeBigInt64BE(BigInt(data.temperature));

    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64BE(BigInt(data.timestamp));

    const sensorIdBytes = Buffer.from(data.sensor_id, 'utf8');

    return Buffer.concat([
        humidityBytes,
        sensorIdBytes,
        temperatureBytes,
        timestampBytes
    ]);
}

/// Genera datos de sensor firmados con Ed25519
export function generateSignedSensorData(
    sensor_id: string,
    temperature: number,
    humidity: number,
    timestamp: number
): SensorData {
    const tempData = {
        sensor_id,
        temperature,
        humidity,
        timestamp,
        signature: '',
        public_key: ''
    };

    const message = buildMessage(tempData);
    const keyPair = nacl.sign.keyPair();
    const signature = nacl.sign.detached(message, keyPair.secretKey);

    return {
        sensor_id,
        temperature,
        humidity,
        timestamp,
        signature: Buffer.from(signature).toString('hex'),
        public_key: Buffer.from(keyPair.publicKey).toString('hex')
    };
}

export async function findOracleUtxo(
    blockchainProvider: BlockfrostProvider,
    oracleAddress: string,
    nftPolicyId: string,
    nftAssetName: string
): Promise<any | null> {
    console.log("🔍 Searching for oracle UTXO...")
    console.log("  Address:", oracleAddress)
    console.log("  NFT:", `${nftPolicyId}.${nftAssetName}`)

    const utxos = await blockchainProvider.fetchAddressUTxOs(oracleAddress);

    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    for (const utxo of utxos) {
        for (const asset of utxo.output.amount) {
            if (asset.unit === nftUnit && asset.quantity === "1") {
                console.log("  ✓ Found oracle UTXO:", `${utxo.input.txHash}#${utxo.input.outputIndex}`)
                return utxo;
            }
        }
    }

    console.log("  ✗ Oracle UTXO not found")
    return null;
}

/**
 * Actualiza un oracle existente con nuevos datos de sensor
 * @param params Parámetros de configuración y datos del sensor
 * @returns Transaction hash de la actualización
 */
export async function updateOracle(params: UpdateOracleParams): Promise<string> {
    const { blockfrostApiKey, privateKey, networkId, nftPolicyId, nftAssetName, sensorData } = params;

    // Inicializar provider, wallet y txBuilder con los parámetros proporcionados
    const blockchainProvider = new BlockfrostProvider(blockfrostApiKey);

    const txBuilder = new MeshTxBuilder({
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        evaluator: blockchainProvider,
        verbose: true
    });

    const wallet = new MeshWallet({
        networkId,
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        key: {
            type: "root",
            bech32: privateKey
        },
    });
    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();

    if (!collateral[0]) {
        throw new Error("No collateral available");
    }

    // Obtener el payment credential del wallet para usar como operator
    const walletAddrDetails = deserializeAddress(walletAddr);
    const operatorPubKeyHash = walletAddrDetails.pubKeyHash;

    if (!operatorPubKeyHash) {
        throw new Error("Could not extract pubKeyHash from wallet address");
    }

    // Aplicar parámetros al script (igual que en create_oracle.ts)
    const codeWithParams = applyParamsToScript(
        applyCborEncoding(oracle_validator_code),
        [
            mConStr0([nftPolicyId, nftAssetName]),
            operatorPubKeyHash
        ]
    );

    const oracleScript: PlutusScript = {
        code: codeWithParams,
        version: "V3",
    };

    const oracleScriptAddr = serializePlutusScript(oracleScript).address;

    // Buscar el UTXO del oracle
    const oracleUtxo = await findOracleUtxo(blockchainProvider, oracleScriptAddr, nftPolicyId, nftAssetName);

    if (!oracleUtxo) {
        throw new Error("Oracle UTXO not found. Make sure the oracle was created first.");
    }

    // Leer el datum actual del UTXO (inline datum)
    const currentDatum = oracleUtxo.output.plutusData;
    if (!currentDatum) {
        throw new Error("Oracle UTXO does not have inline datum");
    }

    console.log("\\n📋 Current Datum (from UTXO):");
    console.log("  Type:", typeof currentDatum);
    console.log("  Value:", JSON.stringify(currentDatum, null, 2));

    // Construir el nuevo datum con los datos actualizados del sensor
    // Formato: SensorData { sensor_id, temperature, humidity, timestamp, signature, public_key }
    const newDatum = mConStr0([
        sensorData.sensor_id,
        sensorData.temperature,
        sensorData.humidity,
        sensorData.timestamp,
        sensorData.signature,     // hex string
        sensorData.public_key     // hex string
    ]);

    // Redeemer: Update (constructor 0)
    const redeemer = mConStr0([]);

    console.log("🔄 Updating Oracle...")
    console.log("  Oracle Address:", oracleScriptAddr)
    console.log("  UTXO:", `${oracleUtxo.input.txHash}#${oracleUtxo.input.outputIndex}`)
    console.log("\n📊 New Sensor Data:")
    console.log("  Sensor ID:", sensorData.sensor_id)
    console.log("  Temperature:", sensorData.temperature / 10, "°C")
    console.log("  Humidity:", sensorData.humidity / 10, "%")
    console.log("  Timestamp:", new Date(sensorData.timestamp).toISOString())

    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    const unsignedTx = await txBuilder
        // Spending Plutus V3 script - debe ir PRIMERO
        .spendingPlutusScriptV3()
        // Input: consume oracle UTXO
        .txIn(
            oracleUtxo.input.txHash,
            oracleUtxo.input.outputIndex,
            oracleUtxo.output.amount,
            oracleScriptAddr
        )
        .txInScript(oracleScript.code)
        .txInInlineDatumPresent()  // Indica que el datum está inline en el UTXO
        .txInRedeemerValue(redeemer)
        // Output: nuevo UTXO del oracle con datum actualizado
        .txOut(oracleScriptAddr, [
            { unit: "lovelace", quantity: "2000000" },
            { unit: nftUnit, quantity: "1" }
        ])
        .txOutInlineDatumValue(newDatum)
        // Collateral para script execution
        .txInCollateral(
            collateral[0].input.txHash,
            collateral[0].input.outputIndex,
            collateral[0].output.amount,
            collateral[0].output.address
        )
        // Required signatories: el operador debe firmar
        .requiredSignerHash(operatorPubKeyHash)
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete();

    const signedTx = await wallet.signTx(unsignedTx)
    const txHash = await wallet.submitTx(signedTx)

    console.log("\n✅ Oracle Updated Successfully!")
    console.log("  Tx Hash:", txHash)

    return txHash;
}

// ============================================================================
// CLI Wrapper - Solo se ejecuta cuando el script se llama directamente
// ============================================================================

async function main() {
    const nftPolicyId = process.argv[2];
    const nftAssetName = process.argv[3];
    const numUpdates = parseInt(process.argv[4] || "3");

    if (!nftPolicyId || !nftAssetName) {
        console.error("❌ Usage: npm run oracle:update -- <nft_policy_id> <nft_asset_name> [num_updates]");
        console.error("   Example: npm run oracle:update -- e659c328b17c189898d2e763c4982a0787ccb1474c096b482ec78594 53454e534f525f45535033325f3031 3");
        process.exit(1);
    }

    if (!process.env.BLOCKFROST_API_KEY || !process.env.PRIVATE_KEY) {
        console.error("❌ Error: BLOCKFROST_API_KEY and PRIVATE_KEY must be set in .env");
        process.exit(1);
    }

    console.log("=".repeat(60))
    console.log("Update Sensor Oracle Script (Ed25519)")
    console.log("=".repeat(60))
    console.log(`Will perform ${numUpdates} updates\n`)

    // Datos de ejemplo para las actualizaciones
    // Cada actualización genera una nueva firma Ed25519 válida
    const sensorReadings = [
        { temp: 235, hum: 652 },  // 23.5°C, 65.2%
        { temp: 240, hum: 680 },  // 24.0°C, 68.0%
        { temp: 225, hum: 620 },  // 22.5°C, 62.0%
        { temp: 245, hum: 700 },  // 24.5°C, 70.0%
        { temp: 230, hum: 640 },  // 23.0°C, 64.0%
    ];

    for (let i = 0; i < Math.min(numUpdates, sensorReadings.length); i++) {
        console.log(`\n${"=".repeat(60)}`)
        console.log(`Update ${i + 1} of ${numUpdates}`)
        console.log("=".repeat(60))

        const reading = sensorReadings[i];
        if (!reading) {
            console.error(`  ✗ No reading data available for update ${i + 1}`);
            break;
        }

        console.log(`\n🔑 Generando firma Ed25519 para actualización ${i + 1}...`)
        const sensorData = generateSignedSensorData(
            "ESP32_001",
            reading.temp,
            reading.hum,
            Date.now()
        );
        console.log(`  ✅ Firma generada exitosamente`)

        try {
            const txHash = await updateOracle({
                blockfrostApiKey: process.env.BLOCKFROST_API_KEY!,
                privateKey: process.env.PRIVATE_KEY!,
                networkId: 0,
                nftPolicyId,
                nftAssetName,
                sensorData
            });
            console.log(`  ✓ Update ${i + 1} completed: ${txHash}`)

            // Esperar un poco entre actualizaciones para que se confirmen
            if (i < numUpdates - 1) {
                console.log("\n  ⏳ Waiting 30 seconds for confirmation before next update...")
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        } catch (err) {
            console.error(`  ✗ Update ${i + 1} failed:`, err)
            throw err;
        }
    }

    console.log("\n📋 Summary:")
    console.log(`  Completed ${numUpdates} updates successfully!`)
    console.log("\nℹ️  All sensor readings have been validated on-chain with Ed25519 signatures!")
}

// Solo ejecutar si este archivo se llama directamente (no cuando se importa)
// ESM: usar import.meta.url en lugar de require.main
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main()
        .then(() => console.log("\n✨ Done"))
        .catch((err) => {
            console.error("\n❌ Error:", err)
            process.exit(1)
        });
}
