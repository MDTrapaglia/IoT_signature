import {
    applyCborEncoding,
    type PlutusScript,
    serializePlutusScript
} from "@meshsdk/core"

// Código compilado del validador simple_ed25519
const simple_ed25519_code = "58bb01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c034dd5000cdd7180798069baa0019bae300f3010300d3754002b95180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

const script: PlutusScript = {
    code: applyCborEncoding(simple_ed25519_code),
    version: "V3",
};

const scriptAddr = serializePlutusScript(script).address;

console.log("=".repeat(60))
console.log("Script Address del Validador Ed25519")
console.log("=".repeat(60))
console.log("\nHash:", "30e42aa15f16b5e8cb5985efec71a567b437561102fd4d38b4d56571")
console.log("Address:", scriptAddr)
console.log("=".repeat(60))
