import { parseNearAmount } from "@near-js/utils";
import { internalActionToNaj } from "@near-wallet-selector/core";
import {
  RoditAuthService,
  verifyRoditBeforeMinting,
  validateAndSetUrl,
  validateAndSetDate,
  bufferUtils,
  validateSignatureFormat,
  verifyFeeSignatureBeforeMinting,
  canonicalizeObject,
  logger,
} from "@rodit/rodit-auth-fe";
import { calculateMintFeeNear } from "./utils/fees";
import { ulid } from "ulid";
import { safeErrorFields } from "./utils/safeErrorFields";

const extractSignClientDetailsFromMessage = (message) => {
  if (typeof message !== "string") return null;
  const detailsIndex = message.indexOf("Details:");
  if (detailsIndex === -1) return null;

  const rawDetails = message.slice(detailsIndex + "Details:".length).trim();
  if (!rawDetails) return null;

  try {
    return JSON.parse(rawDetails);
  } catch (error) {
    return null;
  }
};

const isNetworkOrCorsFailureMessage = (message) => {
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("networkerror when attempting to fetch resource") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("cors request did not succeed") ||
    normalized.includes("network request failed")
  );
};

const buildSignClientErrorMessage = (errorPayload) => {
  if (!errorPayload || typeof errorPayload !== "object") {
    return "The signing IdentyClaw Passport returned an unexpected error. Please try again.";
  }

  const structuredError =
    errorPayload.error && typeof errorPayload.error === "object"
      ? errorPayload.error
      : null;
  const details = structuredError?.details || errorPayload.details || null;
  const code = structuredError?.code || errorPayload.code || "";
  const message =
    structuredError?.message ||
    errorPayload.message ||
    (typeof errorPayload.error === "string" ? errorPayload.error : "");

  if (isNetworkOrCorsFailureMessage(message)) {
    return "The signing IdentyClaw Passport API is currently unreachable (network/CORS error). Please verify service availability and try again.";
  }

  if (
    code === "SIGNCLIENT_PERMISSIONS_INVALID" ||
    message === "Invalid permissions requested"
  ) {
    const invalidRoutes = Array.isArray(details?.invalidRoutes)
      ? details.invalidRoutes
      : [];
    const invalidList = invalidRoutes.length
      ? invalidRoutes.join(", ")
      : "unknown routes";
    return `Invalid permissioned routes requested: ${invalidList}. Update the configured endpoints and try again.`;
  }

  if (message) {
    return `IdentyClaw Passport error: ${message}. Please try again.`;
  }

  return "The signing IdentyClaw Passport returned an error. Please try again.";
};


export class Contract {
  constructor({ contractId, walletToUse }) {
    this.contractId = contractId;
    this.wallet = walletToUse;
  }

  async listrodits() {
    return this.wallet.viewMethod({
      contractId: this.contractId,
      method: "rodit_tokens",
      argVM: {
        from_index: null,
        limit: 200,
      },
    });
  }

  async viewAuthorizedSigners() {
    return this.wallet.viewMethod({
      contractId: this.contractId,
      method: "view_authorized_signers",
    });
  }

  async buildsetofrodit(
    numberofrodit,
    notafter,
    maxrequests,
    maxrqwindow,
    webhookurl,
    userselecteddn,
    permissionedroutes,
    owneraccountid
  ) {
    const mintQuantity = numberofrodit;
    const serviceEndDate = notafter;
    const requestLimit = maxrequests;
    const requestWindowSeconds = maxrqwindow;
    const webhookUrl = webhookurl;
    const userSelectedDn = userselecteddn;
    const permissionedRoutes = permissionedroutes;
    const ownerAccountId = owneraccountid;

    const requestId = ulid();

    try {
      const providerSelectedValues = {
        signapiendpoint: process.env.REACT_APP_SIGNAPIENDPOINT,
        mintingfee_account: process.env.REACT_APP_MINTING_FEEACCOUNT,
      };

      const feeCalc = calculateMintFeeNear({
        maxRequests: Number(requestLimit),
        requestWindowSeconds: Number(requestWindowSeconds),
        serviceEndDate,
        baselineFeeNear: Number(process.env.REACT_APP_MINTING_FEE),
      });
      const dynamicFeeNear = feeCalc.perRoditNear;
      const tier = feeCalc.tier;

      providerSelectedValues.mintingfee = dynamicFeeNear.toString();

      const auth = new RoditAuthService(
        this.wallet,
        providerSelectedValues.signapiendpoint,
        null
      );

      const deposit = parseNearAmount(
        providerSelectedValues.mintingfee
      );

      const GAS_PER_ACTION = "100000000000000"; // 100 TeraGas per mint action
      let gas = GAS_PER_ACTION;

      const tobesignedValues = {
        not_after: validateAndSetDate(serviceEndDate),
        max_requests: String(requestLimit),
        maxrq_window: String(requestWindowSeconds),
        permissioned_routes: permissionedRoutes,
      };

      const actionset = await Promise.all(
        Array.from({ length: mintQuantity }, async (_, index) => {
          const actionIndex = index + 1;

          try {
            let signedValues;
            const tokenId = "bcdfhjkmnpqr";
            try {
              const requestBody = {
                tobesignedValues,
                mintingfee: providerSelectedValues.mintingfee,
                mintingfee_account: providerSelectedValues.mintingfee_account,
                token_id: tokenId,
                tier: tier,
              };

              signedValues = await auth.fetchWithErrorHandling_fe(
                `${providerSelectedValues.signapiendpoint}/api/signclient`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(requestBody),
                }
              );
            } catch (apiError) {
              logger.error("mint.sign_client_failed", {
                component: "mint",
                requestId,
                actionIndex,
                ...safeErrorFields(apiError),
              });
              throw new Error(buildSignClientErrorMessage(apiError));
            }

            if (signedValues?.error === "RequestFailed" && signedValues?.message) {
              if (isNetworkOrCorsFailureMessage(signedValues.message)) {
                throw new Error(
                  "The signing IdentyClaw Passport API is currently unreachable (network/CORS error). Please verify service availability and try again."
                );
              }
              const details = extractSignClientDetailsFromMessage(
                signedValues.message
              );
              if (details) {
                throw new Error(buildSignClientErrorMessage(details));
              }
              throw new Error(
                "The signing IdentyClaw Passport returned an error. Please try again."
              );
            }

            if (!signedValues || typeof signedValues !== "object") {
              throw new Error("The signing IdentyClaw Passport did not return a valid response. Please try again later.");
            }

            const feeDataFromApi = signedValues.fee_data;
            if (!feeDataFromApi || !feeDataFromApi.mintingfee) {
              throw new Error("API response missing fee_data with mintingfee");
            }

            const feeDataForVerification = feeDataFromApi;

            if (!signedValues.fee_signature_base64url) {
              throw new Error("API response missing fee_signature_base64url");
            }

            let authorizedSigners;
            try {
              authorizedSigners = await this.viewAuthorizedSigners();
            } catch (error) {
              logger.error("mint.authorized_signers_failed", {
                component: "mint",
                requestId,
                actionIndex,
                ...safeErrorFields(error),
              });
              throw new Error("Failed to fetch authorized signers for fee signature validation");
            }

            if (!authorizedSigners || authorizedSigners.length === 0) {
              throw new Error("No authorized signers configured in contract");
            }

            const canonicalFeeData = canonicalizeObject(feeDataForVerification);
            const feeDataJson = JSON.stringify(canonicalFeeData);

            let feeSignatureValid = false;
            let lastError = null;

            for (let i = 0; i < authorizedSigners.length; i++) {
              const signerPublicKeyHex = authorizedSigners[i];
              const signerPublicKey = bufferUtils.hexToUint8Array(signerPublicKeyHex);

              const verificationResult = verifyFeeSignatureBeforeMinting(
                feeDataJson,
                signedValues.fee_signature_base64url,
                signerPublicKey
              );

              if (verificationResult.success) {
                feeSignatureValid = true;
                break;
              }
              lastError = verificationResult.error;
            }

            if (!feeSignatureValid) {
              throw new Error(`Fee signature verification failed with all authorized signers. Last error: ${lastError}`);
            }

            const signedValuesToMint = {
              token_id: signedValues.token_id,
              openapijson_url: signedValues.openapijson_url,
              not_after: tobesignedValues.not_after,
              not_before: signedValues.not_before,
              max_requests: tobesignedValues.max_requests,
              maxrq_window: tobesignedValues.maxrq_window,
              webhook_cidr: signedValues.webhook_cidr,
              allowed_cidr: signedValues.allowed_cidr,
              allowed_iso3166list: signedValues.allowed_iso3166list,
              jwt_duration: signedValues.jwt_duration,
              permissioned_routes: tobesignedValues.permissioned_routes,
              subjectuniqueidentifier_url:
                signedValues.subjectuniqueidentifier_url,
              serviceprovider_id: signedValues.serviceprovider_id,
              serviceprovider_signature: signedValues.serviceprovider_signature,
            };

            if (typeof signedValues.serviceprovider_signature !== "string" || !signedValues.serviceprovider_signature.length) {
              throw new Error("Signing IdentyClaw Passport inaccesible, please try again later.");
            }

            validateSignatureFormat(
              signedValues.serviceprovider_signature,
              requestId
            );

            let SignerPublicKey;
            try {
              SignerPublicKey = bufferUtils.base64urlToUint8Array(
                signedValues.serviceprovider_public_key_base64url
              );
            } catch (publicKeyError) {
              logger.error("mint.public_key_failed", {
                component: "mint",
                requestId,
                actionIndex,
                ...safeErrorFields(publicKeyError),
                stack: publicKeyError?.stack,
              });
              throw new Error(
                `Failed to process public key: ${publicKeyError.message}`
              );
            }

            try {
              const verificationResult = await verifyRoditBeforeMinting(
                signedValuesToMint,
                SignerPublicKey,
                "client"
              );

              if (!verificationResult) {
                logger.error("mint.rodit_verify_failed", {
                  component: "mint",
                  requestId,
                  actionIndex,
                });
                throw new Error(
                  "RODiT ID verification failed - aborting mint"
                );
              }
            } catch (verificationError) {
              if (
                verificationError?.message === "RODiT ID verification failed - aborting mint"
              ) {
                throw verificationError;
              }
              logger.error("mint.rodit_verify_exception", {
                component: "mint",
                requestId,
                actionIndex,
                ...safeErrorFields(verificationError),
                stack: verificationError?.stack,
              });
              throw new Error(
                `Signature verification failed with error: ${verificationError.message}`
              );
            }

            const action = {
              type: "FunctionCall",
              params: {
                methodName: "rodit_mint",
                args: {
                  token_id: signedValuesToMint.token_id,
                  metadata: {
                    openapijson_url: signedValuesToMint.openapijson_url,
                    not_after: signedValuesToMint.not_after,
                    not_before: signedValuesToMint.not_before,
                    max_requests: signedValuesToMint.max_requests,
                    maxrq_window: signedValuesToMint.maxrq_window,
                    webhook_url: validateAndSetUrl(webhookUrl, "webhook_url"),
                    webhook_cidr: signedValuesToMint.webhook_cidr,
                    userselected_dn: userSelectedDn,
                    allowed_cidr: signedValuesToMint.allowed_cidr,
                    allowed_iso3166list: signedValuesToMint.allowed_iso3166list,
                    jwt_duration: signedValuesToMint.jwt_duration,
                    permissioned_routes: signedValuesToMint.permissioned_routes,
                    subjectuniqueidentifier_url:
                      signedValuesToMint.subjectuniqueidentifier_url,
                    serviceprovider_id: signedValuesToMint.serviceprovider_id,
                    serviceprovider_signature:
                      signedValuesToMint.serviceprovider_signature,
                  },
                  owneraccount_id: ownerAccountId.toLowerCase(),
                  mintingfee_account: providerSelectedValues.mintingfee_account,
                  mintingfee_value: feeDataFromApi.mintingfee,
                  fee_data_json: feeDataJson,
                  fee_signature_base64url: signedValues.fee_signature_base64url,
                },
                gas,
                deposit,
              },
            };

            return action;
          } catch (error) {
            logger.error("mint.action_failed", {
              component: "mint",
              requestId,
              actionIndex,
              ...safeErrorFields(error),
              stack: error?.stack,
            });
            throw new Error(`Failed to create action: ${error.message}`);
          }
        })
      );

      try {
        const najActions = actionset.map((a) => internalActionToNaj(a));
        const { contractResult, transactionHash } = await this.wallet.callMethod(
          this.contractId,
          najActions
        );
        return { result: contractResult, transactionHash };
      } catch (contractError) {
        logger.error("mint.contract_call_failed", {
          component: "mint",
          requestId,
          ...safeErrorFields(contractError),
          stack: contractError?.stack,
        });
        throw contractError;
      }
    } catch (error) {
      logger.error("mint.build_failed", {
        component: "mint",
        requestId,
        ...safeErrorFields(error),
        stack: error?.stack,
      });
      throw error;
    }
  }
}
