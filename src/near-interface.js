import { utils } from "near-api-js";
import {
  RoditAuthService,
  verifyRoditPairBeforeMinting
} from "../sdk/frontend/rodit_fe.js";
import {
  validateAndSetUrl,
  validateAndSetDate,
  validateAndSetJson,
  validateAndSetSignature,
  base64ToBase64Url,
  calculateCanonicalHash,
  canonicalizeObject,
  bufferUtils
} from "../sdk/utils";

const bs58 = require("bs58");
const nacl = require("tweetnacl");

const THIRTY_TGAS = "25000000000000";

export class Contract {
  constructor({ contractId, walletToUse }) {
    this.contractId = contractId;
    this.wallet = walletToUse;
  }

  async listrodits() {
    return this.wallet.viewMethod({
      contractId: this.contractId,
      method: "rodit_tokens",
    });
  }

  async buildpairofrodits(
    openapijsonurl,
    notbefore,
    subjectuniqueidentifierurl,
    SanctumBase58PrivateKey,
    SanctumOwnerAccountId
  ) {
    const providerSelectedValues = {
      scaccountid: process.env.REACT_APP_NEAR_CONTRACT_ID,
      mintingfeeaccount: process.env.REACT_APP_MINTING_FEEACCOUNT,
      mintingfee: process.env.REACT_APP_MINTING_FEE,
      signapiendpoint: process.env.REACT_APP_SIGNAPIENDPOINT,
    };

    const defaultValues = {
      notafter: process.env.REACT_APP_NOTAFTER,
      maxrequests: process.env.REACT_APP_MAXREQUESTS,
      maxrqwindow: process.env.REACT_APP_MAXRQWINDOW,
      webhookurl: process.env.REACT_APP_WEBHOOKURL,
      userselecteddn: process.env.REACT_APP_USERSELECTEDDN,
      webhookcidr: process.env.REACT_APP_WEBHOOKCIDR,
      allowedcidr: process.env.REACT_APP_ALLOWEDCIDR,
      allowediso3166list: process.env.REACT_APP_ALLOWEDISO3166LIST,
      jwtduration: process.env.REACT_APP_JWTDURATION,
      permissionedroutes: process.env.REACT_APP_PERMISSIONEDROUTES,
    };

    const gas = THIRTY_TGAS;
    const deposit = utils.format.parseNearAmount(
      providerSelectedValues.mintingfee
    );

    try {
      // Creating shared values WITHOUT webhook_url and userselected_dn for verification
      const SharedValues = {
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(notbefore),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
      };

      const auth = new RoditAuthService(
        this.wallet,
        providerSelectedValues.signapiendpoint,
        null
      );

      const SanctumBase64URLSignatureWithPortalsAndIDs =
        await auth.fetchWithErrorHandling_fe(
          `${providerSelectedValues.signapiendpoint}/api/root/signroot`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              SharedValues,
              mintingfee: providerSelectedValues.mintingfee,
              mintingfeeaccount: providerSelectedValues.mintingfeeaccount,
            }),
          }
        );

      if (SanctumBase64URLSignatureWithPortalsAndIDs.error) {
        throw new Error(
          `API Error: ${
            SanctumBase64URLSignatureWithPortalsAndIDs.message ||
            "Unknown error"
          }`
        );
      }

      const {
        portal_token_id,
        sanctum_token_id,
        combined_id_portal,
        combined_id_sanctum,
        serviceprovider_signature: SanctumBase64URLSignatureWithPortal,
        serviceprovider_public_key_base64url,
        fee_signature_base64url,
      } = SanctumBase64URLSignatureWithPortalsAndIDs;

      console.log("[DEBUG] API Response IDs:", {
        portal_token_id,
        sanctum_token_id,
        combined_id_portal,
        combined_id_sanctum,
      });

      const PortalValuesToBless = {
        token_id: portal_token_id,
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(notbefore),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        serviceprovider_id: combined_id_portal,
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
      };

      // Sign sanctum values
      const SanctumBytesPrivateKey = new Uint8Array(
        bs58.decode(SanctumBase58PrivateKey)
      );

      const PortalHashToSign = calculateCanonicalHash(PortalValuesToBless);
      const PortalBytesHash = bufferUtils.hexToUint8Array(PortalHashToSign);
      const PortalBytesSignatureWithSanctum = nacl.sign.detached(
        PortalBytesHash,
        SanctumBytesPrivateKey
      );
      const PortalBase64URLSignatureWithSanctum =
        bufferUtils.uint8ArrayToBase64url(PortalBytesSignatureWithSanctum);

      // Create verification metadata - WITHOUT webhook_url and userselected_dn
      const SanctumVerificationMetadata = {
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(notbefore),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
        serviceprovider_id: combined_id_sanctum,
        serviceprovider_signature: validateAndSetSignature(
          base64ToBase64Url(SanctumBase64URLSignatureWithPortal),
          "digital signature"
        ),
      };

      const PortalVerificationMetadata = {
        openapijson_url: validateAndSetUrl(openapijsonurl),
        not_after: validateAndSetDate(defaultValues.notafter),
        not_before: validateAndSetDate(notbefore),
        max_requests: String(defaultValues.maxrequests),
        maxrq_window: String(defaultValues.maxrqwindow),
        webhook_cidr: defaultValues.webhookcidr,
        allowed_cidr: defaultValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          defaultValues.allowediso3166list
        ),
        jwt_duration: String(defaultValues.jwtduration),
        permissioned_routes: validateAndSetJson(
          defaultValues.permissionedroutes
        ),
        serviceprovider_id: combined_id_portal,
        subjectuniqueidentifier_url: validateAndSetUrl(
          subjectuniqueidentifierurl
        ),
        serviceprovider_signature: validateAndSetSignature(
          base64ToBase64Url(PortalBase64URLSignatureWithSanctum),
          "digital signature"
        ),
      };

      // Generate signing keys
      const PortalSignerPublicKey = bufferUtils.base64urlToUint8Array(
        serviceprovider_public_key_base64url
      );

      const SanctumSignerPublicKey = nacl.sign.keyPair.fromSecretKey(
        SanctumBytesPrivateKey
      ).publicKey;

      console.log("[DEBUG] Verification metadata combined IDs:", {
        portalVerificationId: PortalVerificationMetadata.serviceprovider_id,
        sanctumVerificationId: SanctumVerificationMetadata.serviceprovider_id,
        rawPortalId: combined_id_portal,
        rawSanctumId: combined_id_sanctum,
      });

      const verificationResult = await verifyRoditPairBeforeMinting(
        {
          token_id: portal_token_id,
          ...PortalVerificationMetadata,
        },
        {
          token_id: sanctum_token_id,
          ...SanctumVerificationMetadata,
        },
        PortalSignerPublicKey,
        SanctumSignerPublicKey
      );

      if (!verificationResult) {
        throw new Error("RODiT pair verification failed - aborting mint");
      }

      // Create minting metadata - WITH webhook_url and userselected_dn for both
      // Important: Create completely new objects with all fields explicitly set
      const SanctumMintingMetadata = {
        openapijson_url: SanctumVerificationMetadata.openapijson_url,
        not_after: SanctumVerificationMetadata.not_after,
        not_before: SanctumVerificationMetadata.not_before,
        max_requests: String(SanctumVerificationMetadata.max_requests),
        maxrq_window: String(SanctumVerificationMetadata.maxrq_window),
        webhook_cidr: SanctumVerificationMetadata.webhook_cidr,
        allowed_cidr: SanctumVerificationMetadata.allowed_cidr,
        allowed_iso3166list: SanctumVerificationMetadata.allowed_iso3166list,
        jwt_duration: SanctumVerificationMetadata.jwt_duration,
        permissioned_routes: SanctumVerificationMetadata.permissioned_routes,
        subjectuniqueidentifier_url:
          SanctumVerificationMetadata.subjectuniqueidentifier_url,
        serviceprovider_id: SanctumVerificationMetadata.serviceprovider_id,
        serviceprovider_signature:
          SanctumVerificationMetadata.serviceprovider_signature,
        webhook_url: validateAndSetUrl(defaultValues.webhookurl),
        userselected_dn: defaultValues.userselecteddn,
      };

      const PortalMintingMetadata = {
        openapijson_url: PortalVerificationMetadata.openapijson_url,
        not_after: PortalVerificationMetadata.not_after,
        not_before: PortalVerificationMetadata.not_before,
        max_requests: String(PortalVerificationMetadata.max_requests),
        maxrq_window: String(PortalVerificationMetadata.maxrq_window),
        webhook_cidr: PortalVerificationMetadata.webhook_cidr,
        allowed_cidr: PortalVerificationMetadata.allowed_cidr,
        allowed_iso3166list: PortalVerificationMetadata.allowed_iso3166list,
        jwt_duration: PortalVerificationMetadata.jwt_duration,
        permissioned_routes: PortalVerificationMetadata.permissioned_routes,
        subjectuniqueidentifier_url:
          PortalVerificationMetadata.subjectuniqueidentifier_url,
        serviceprovider_id: PortalVerificationMetadata.serviceprovider_id,
        serviceprovider_signature:
          PortalVerificationMetadata.serviceprovider_signature,
        webhook_url: validateAndSetUrl(defaultValues.webhookurl),
        userselected_dn: defaultValues.userselecteddn,
      };

      // Add debug logging for final metadata
      console.log("Debug final metadata types:", {
        sanctum: {
          token_id: typeof sanctum_token_id,
          max_requests: typeof SanctumMintingMetadata.max_requests,
          maxrq_window: typeof SanctumMintingMetadata.maxrq_window,
          jwt_duration: typeof SanctumMintingMetadata.jwt_duration,
          allowed_iso3166list:
            typeof SanctumMintingMetadata.allowed_iso3166list,
          permissioned_routes:
            typeof SanctumMintingMetadata.permissioned_routes,
        },
        portal: {
          token_id: typeof portal_token_id,
          max_requests: typeof PortalMintingMetadata.max_requests,
          maxrq_window: typeof PortalMintingMetadata.maxrq_window,
          jwt_duration: typeof PortalMintingMetadata.jwt_duration,
          allowed_iso3166list: typeof PortalMintingMetadata.allowed_iso3166list,
          permissioned_routes: typeof PortalMintingMetadata.permissioned_routes,
        },
      });

      console.debug("Transaction details:", {
        sanctum_token_id,
        portal_token_id,
        owneraccount_id: SanctumOwnerAccountId,
        mintingfee_account: providerSelectedValues.mintingfeeaccount,
        fee_signature_base64url: {
          value: fee_signature_base64url,
          length: fee_signature_base64url?.length
        }
      });

      // Create mint actions - using the minting metadata with added fields
      const actionset = [
        {
          type: "FunctionCall",
          params: {
            methodName: "rodit_mint",
            args: {
              token_id: sanctum_token_id,
              metadata: SanctumMintingMetadata,
              owneraccount_id: SanctumOwnerAccountId,
              mintingfee_account: providerSelectedValues.mintingfeeaccount,
              fee_signature_base64url: fee_signature_base64url,
            },
            gas,
            deposit,
          },
        },
        {
          type: "FunctionCall",
          params: {
            methodName: "rodit_mint",
            args: {
              token_id: portal_token_id,
              metadata: PortalMintingMetadata,
              owneraccount_id: SanctumOwnerAccountId,
              mintingfee_account: providerSelectedValues.mintingfeeaccount,
              fee_signature_base64url: fee_signature_base64url,
            },
            gas,
            deposit,
          },
        },
      ];

      return await this.wallet.callMethod(this.contractId, actionset);
    } catch (error) {
      throw error;
    }
  }
}
