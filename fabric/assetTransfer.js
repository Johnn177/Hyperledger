'use strict';

/*
 ============================================================
 IMPORTACIONES
 ============================================================
*/

// JSON.stringify determinístico.
// Garantiza que las claves siempre tengan el mismo orden,
// algo necesario en Hyperledger Fabric para que todos los peers
// generen el mismo hash.
const stringify = require('json-stringify-deterministic');

// Ordena recursivamente las claves de un objeto en orden alfabético.
const sortKeysRecursive = require('sort-keys-recursive');

// Clase base para crear contratos (chaincodes) en Fabric
const { Contract } = require('fabric-contract-api');


/*
 ============================================================
 DEFINICIÓN DEL CONTRATO (CHAINCODE)
 ============================================================
*/
class AssetTransfer extends Contract {

    /*
     ------------------------------------------------------------
     InitLedger()
     ------------------------------------------------------------
     Inicializa el ledger con datos de ejemplo.
     Se ejecuta normalmente una sola vez después del deploy.
    */
    async InitLedger(ctx) {

        // Activos iniciales de prueba
        const assets = [
            { ID: 'asset1', Color: 'blue',   Size: 5,  Owner: 'Tomoko',  AppraisedValue: 300 },
            { ID: 'asset2', Color: 'red',    Size: 5,  Owner: 'Brad',    AppraisedValue: 400 },
            { ID: 'asset3', Color: 'green',  Size: 10, Owner: 'Jin Soo', AppraisedValue: 500 },
            { ID: 'asset4', Color: 'yellow', Size: 10, Owner: 'Max',     AppraisedValue: 600 },
            { ID: 'asset5', Color: 'black',  Size: 15, Owner: 'Adriana', AppraisedValue: 700 },
            { ID: 'asset6', Color: 'white',  Size: 15, Owner: 'Michel',  AppraisedValue: 800 },
        ];

        // Insertar cada asset en el World State
        for (const asset of assets) {

            // Tipo de documento (útil para queries complejas)
            asset.docType = 'asset';

            /*
             putState(key, value)
             key   -> ID del asset
             value -> Buffer con JSON determinístico
            */
            await ctx.stub.putState(
                asset.ID,
                Buffer.from(stringify(sortKeysRecursive(asset)))
            );
        }
    }


    /*
     ------------------------------------------------------------
     CreateAsset()
     ------------------------------------------------------------
     Crea un nuevo activo en el World State.
    */
    async CreateAsset(ctx, id, color, size, owner, appraisedValue) {

        // Verificar si ya existe
        const exists = await this.AssetExists(ctx, id);
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }

        // Crear objeto asset
        const asset = {
            ID: id,
            Color: color,
            Size: Number(size),                 // convertir a número
            Owner: owner,
            AppraisedValue: Number(appraisedValue),
        };

        // Guardar en el ledger
        await ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(asset)))
        );

        return JSON.stringify(asset);
    }


    /*
     ------------------------------------------------------------
     ReadAsset()
     ------------------------------------------------------------
     Obtiene un asset desde el World State.
    */
    async ReadAsset(ctx, id) {

        // Leer estado por clave
        const assetJSON = await ctx.stub.getState(id);

        // Validar existencia
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }

        // Convertir buffer a string
        return assetJSON.toString();
    }


    /*
     ------------------------------------------------------------
     UpdateAsset()
     ------------------------------------------------------------
     Actualiza completamente un asset existente.
    */
    async UpdateAsset(ctx, id, color, size, owner, appraisedValue) {

        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        // Crear nuevo objeto con valores actualizados
        const updatedAsset = {
            ID: id,
            Color: color,
            Size: size,
            Owner: owner,
            AppraisedValue: appraisedValue,
        };

        // Sobrescribir estado
        return ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(updatedAsset)))
        );
    }


    /*
     ------------------------------------------------------------
     DeleteAsset()
     ------------------------------------------------------------
     Elimina un asset del ledger.
    */
    async DeleteAsset(ctx, id) {

        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        // Eliminar del World State
        return ctx.stub.deleteState(id);
    }


    /*
     ------------------------------------------------------------
     AssetExists()
     ------------------------------------------------------------
     Verifica si un asset existe.
     Devuelve true o false.
    */
    async AssetExists(ctx, id) {

        const assetJSON = await ctx.stub.getState(id);

        return assetJSON && assetJSON.length > 0;
    }


    /*
     ------------------------------------------------------------
     TransferAsset()
     ------------------------------------------------------------
     Cambia el propietario del asset.
    */
    async TransferAsset(ctx, id, newOwner) {

        // Leer asset existente
        const assetString = await this.ReadAsset(ctx, id);
        const asset = JSON.parse(assetString);

        const oldOwner = asset.Owner;

        // Cambiar propietario
        asset.Owner = newOwner;

        // Guardar nuevamente
        await ctx.stub.putState(
            id,
            Buffer.from(stringify(sortKeysRecursive(asset)))
        );

        // devolver dueño anterior
        return oldOwner;
    }


    /*
     ------------------------------------------------------------
     GetAllAssets()
     ------------------------------------------------------------
     Devuelve TODOS los assets almacenados.
    */
    async GetAllAssets(ctx) {

        const allResults = [];

        /*
         Consulta por rango:
         '' -> inicio vacío
         '' -> fin vacío
         => devuelve TODO el namespace del chaincode
        */
        const iterator = await ctx.stub.getStateByRange('', '');

        let result = await iterator.next();

        while (!result.done) {

            const strValue = Buffer
                .from(result.value.value.toString())
                .toString('utf8');

            let record;

            // Intentar parsear JSON
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }

            allResults.push(record);

            result = await iterator.next();
        }

        // devolver arreglo completo
        return JSON.stringify(allResults);
    }
}


/*
 ============================================================
 EXPORTAR CONTRATO
 ============================================================
Fabric cargará esta clase como chaincode activo.
*/
module.exports = AssetTransfer;
