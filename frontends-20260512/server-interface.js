import { utils } from "near-api-js";
import { calculateMintFeeNear } from "./utils/fees";
import {
  validateAndSetUrl,
  validateAndSetDate,
  validateAndSetJson,
  validateAndSetSignature,
  bufferUtils,
  verifyRoditBeforeMinting
} from "@rodit/rodit-auth-fe";


import { ulid } from "ulid"; // Make sure to import ulid

const HUNDRED_AND_FIFTY_TGAS = "150000000000000";

// Helper function to get today's date in YYYY-MM-DD format
// This mirrors the logic used in StepOne component but keeps near-interface self-contained.
const todayDate = () => {
  const date = new Date();
  const currentDate = date.getDate();
  const currentMonth = date.getMonth() + 1; // Months are 0-indexed
  const currentYear = date.getFullYear();
  return (
    currentYear +
    "-" +
    (currentMonth < 10 ? "0" + currentMonth : currentMonth) +
    "-" +
    (currentDate < 10 ? "0" + currentDate : currentDate)
  );
};

export class Contract {
  constructor({ contractId, walletToUse, roditAuth }) {
    this.contractId = contractId;
    this.wallet = walletToUse;
    this.roditAuth = roditAuth;
  }

  async listrodits() {
    return this.wallet.viewMethod({
      contractId: this.contractId,
      method: "rodit_tokens",
    });
  }

  async buildsetofrodit(
    numberofrodit,
    notafter,
    webhookcidr,
    allowedcidr,
    allowediso3166list,
    jwtduration,
    permissionedroutes,
    subjectuniqueidentifierurl,
    owneraccountid
  ) {
    const requestId = ulid();
    console.debug("Starting buildsetofrodit", {
      requestId,
      params: {
        numberofrodit,
        notafter,
        webhookcidr,
        allowedcidr,
        allowediso3166list: JSON.stringify(allowediso3166list),
        jwtduration,
        permissionedroutes: JSON.stringify(permissionedroutes),
        subjectuniqueidentifierurl,
        owneraccountid,
      },
    });

    const serverValues = {
      numberofrodit,
      notafter,
      webhookcidr,
      allowedcidr,
      allowediso3166list,
      jwtduration,
      permissionedroutes,
      subjectuniqueidentifierurl,
      owneraccountid,
    };

    const providerSelectedValues = {
      openapijsonurl: process.env.REACT_APP_OPENAPIJSONURL,
      notbefore: validateAndSetDate(String(todayDate())),
      signapiendpoint: process.env.REACT_APP_SIGNAPIENDPOINT,
      mintingfeeaccount: process.env.REACT_APP_MINTING_FEEACCOUNT,
      mintingfee: process.env.REACT_APP_MINTING_FEE,
    };

    // User selected values
    const userSelectedValues = {
      webhookurl: process.env.REACT_APP_WEBHOOKURL,
      userselecteddn: process.env.REACT_APP_USERSELECTEDDN,
      maxrequests: process.env.REACT_APP_MAXREQUESTS,
      maxrqwindow: process.env.REACT_APP_MAXRQWINDOW,
    };

    console.debug("Configuration values:", {
      requestId,
      serverValues,
      providerValues: {
        ...providerSelectedValues,
        hasEndpoint: !!providerSelectedValues.signapiendpoint,
        hasFeeAccount: !!providerSelectedValues.mintingfeeaccount,
      },
      userValues: {
        ...userSelectedValues,
        hasWebhook: !!userSelectedValues.webhookurl,
      },
    });

    const gas = HUNDRED_AND_FIFTY_TGAS;
    // Compute per-RODiT minting fee using centralized calculator
    const { perRoditNear } = calculateMintFeeNear({
      maxRequests: userSelectedValues.maxrequests,
      maxrqWindow: userSelectedValues.maxrqwindow,
      expirationDate: serverValues.notafter,
      baselineFeeNear: process.env.REACT_APP_MINTING_FEE,
    });

    // Set the provider value so both API/contract and deposit use the same number
    providerSelectedValues.mintingfee = perRoditNear.toString();

    const deposit = utils.format.parseNearAmount(
      providerSelectedValues.mintingfee
    );

    try {
      console.debug("Building tamperproofedValues", { requestId });
      // When creating the tamperproofedValues object
      const tamperproofedValues = {
        openapijson_url: validateAndSetUrl(
          providerSelectedValues.openapijsonurl
        ),
        not_after: validateAndSetDate(serverValues.notafter),
        not_before: validateAndSetDate(providerSelectedValues.notbefore),
        max_requests: String(userSelectedValues.maxrequests),
        maxrq_window: String(userSelectedValues.maxrqwindow),
        webhook_cidr: serverValues.webhookcidr,
        allowed_cidr: serverValues.allowedcidr,
        allowed_iso3166list: validateAndSetJson(
          serverValues.allowediso3166list
        ),
        jwt_duration: serverValues.jwtduration,
        permissioned_routes: validateAndSetJson(
          serverValues.permissionedroutes
        ),
        subjectuniqueidentifier_url: validateAndSetUrl(
          serverValues.subjectuniqueidentifierurl
        )
      };

      console.debug("Built tamperproofedValues:", {
        requestId,
        values: {
          ...tamperproofedValues,
          allowediso3166list: JSON.stringify(
            tamperproofedValues.allowed_iso3166list
          ),
          permissionedroutes: JSON.stringify(
            tamperproofedValues.permissioned_routes
          ),
        },
      });

      // Generate operation ID and store all necessary state
      const operationId = crypto.randomUUID();
      const callbackUrl = `${window.location.origin}/callback/mint/${operationId}`;
      console.debug("Preparing NEP-413 login", {
        requestId,
        operationId,
        callbackUrl,
      });

      const mintParams = {
        operationId,
        params: {
          serverValues,
          providerSelectedValues,
          userSelectedValues,
          tamperproofedValues,
          gas,
          deposit,
        },
      };

      console.debug("Storing mint parameters", {
        requestId,
        operationId,
        paramSummary: {
          hasServerValues: !!mintParams.params.serverValues,
          hasProviderValues: !!mintParams.params.providerSelectedValues,
          hasUserValues: !!mintParams.params.userSelectedValues,
          hasTamperproofedValues: !!mintParams.params.tamperproofedValues,
          hasGas: !!mintParams.params.gas,
          hasDeposit: !!mintParams.params.deposit,
        },
      });

      try {
        sessionStorage.setItem("mintParams", JSON.stringify(mintParams));
        console.debug("Successfully stored mint parameters", {
          requestId,
          operationId,
        });
      } catch (storageError) {
        console.error("Failed to store mint parameters", {
          requestId,
          error: storageError.message,
          stack: storageError.stack,
        });
        throw new Error("Failed to store minting parameters");
      }

      console.debug("Initiating NEP-413 login", {
        requestId,
        operationId,
        callbackUrl,
      });

      await this.roditAuth.login_server_withnep413({
        callbackUrl: callbackUrl,
      });

      console.debug("NEP-413 login initiated", {
        requestId,
        operationId,
      });
    } catch (error) {
      console.error("buildsetofrodit failed:", {
        requestId,
        error: error.message,
        stack: error.stack,
        context: {
          hasServerValues: !!serverValues,
          hasProviderValues: !!providerSelectedValues,
          hasUserValues: !!userSelectedValues,
        },
      });
      throw error;
    }
  }

  async resumeMinting(operationId, currentUrl) {
    const requestId = ulid();
    console.debug("Starting resumeMinting", { requestId, operationId });

    try {
      // Retrieve stored minting parameters
      const storedData = sessionStorage.getItem("mintParams");
      console.debug("Retrieved stored parameters", {
        requestId,
        hasStoredData: !!storedData,
        storedDataLength: storedData ? storedData.length : 0,
      });

      if (!storedData) {
        console.error("No minting parameters found", { requestId });
        throw new Error("No minting parameters found");
      }

      // Parse stored parameters
      let parsedData;
      try {
        parsedData = JSON.parse(storedData);
        console.debug("Parsed stored parameters", {
          requestId,
          storedId: parsedData.operationId,
          hasParams: !!parsedData.params,
          paramKeys: parsedData.params ? Object.keys(parsedData.params) : [],
        });
      } catch (parseError) {
        console.error("Failed to parse stored parameters", {
          requestId,
          error: parseError.message,
          stack: parseError.stack,
          storedData: storedData.substring(0, 100) + "...",
        });
        throw new Error("Invalid stored minting parameters");
      }

      const { operationId: storedId, params } = parsedData;

      // Validate operation ID
      if (operationId !== storedId) {
        console.error("Operation ID mismatch", {
          requestId,
          currentId: operationId,
          storedId,
        });
        throw new Error("Operation ID mismatch");
      }

      // Handle login callback
      console.debug("Handling login callback", {
        requestId,
        currentUrl,
        urlLength: currentUrl.length,
      });

      let jwt_token;
      try {
        const loginResult = await this.roditAuth.handleLoginCallback(
          currentUrl
        );
        jwt_token = loginResult.jwt_token;

        console.debug("Login callback completed", {
          requestId,
          hasToken: !!jwt_token,
          tokenLength: jwt_token ? jwt_token.length : 0,
          tokenPrefix: jwt_token ? jwt_token.substring(0, 10) + "..." : null,
        });
      } catch (loginError) {
        console.error("Login callback failed", {
          requestId,
          error: loginError.message,
          stack: loginError.stack,
        });
        throw new Error(`Login failed: ${loginError.message}`);
      }

      // Create action set
      console.debug("Creating action set", {
        requestId,
        numberofrodit: params.serverValues.numberofrodit,
        signapiendpoint: params.providerSelectedValues.signapiendpoint,
      });

      const actionset = await Promise.all(
        Array.from(
          { length: params.serverValues.numberofrodit },
          async (_, index) => {
            const actionIndex = index + 1;
            console.debug(`Creating action ${actionIndex}`, {
              requestId,
              actionIndex,
              hasParams: !!params,
            });

            // Make API call to get signed values
            console.debug(`Preparing API call for action ${actionIndex}`, {
              requestId,
              endpoint: `${params.providerSelectedValues.signapiendpoint}/api/server/signserver`,
              hasJwtToken: !!this.roditAuth.jwt_token,
              tokenLength: this.roditAuth.jwt_token
                ? this.roditAuth.jwt_token.length
                : 0,
            });

            let signedValuesResponse;
            try {
              signedValuesResponse = await this.roditAuth.fetchWithErrorHandling_fe(
                `${params.providerSelectedValues.signapiendpoint}/api/server/signserver`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tamperproofedValues: params.tamperproofedValues,
                    mintingfee: params.providerSelectedValues.mintingfee,
                    mintingfeeaccount:
                      params.providerSelectedValues.mintingfeeaccount,
                  }),
                }
              );

              console.debug(`API response for action ${actionIndex}`, {
                requestId,
                hasSignedValues: !!signedValuesResponse,
                error: signedValuesResponse.error,
                errorMessage: signedValuesResponse.message,
                responseKeys: signedValuesResponse ? Object.keys(signedValuesResponse) : [],
              });
            } catch (apiError) {
              console.error(`API call failed for action ${actionIndex}`, {
                requestId,
                error: apiError.message,
                stack: apiError.stack,
              });
              throw new Error(`API request failed: ${apiError.message}`);
            }

            if (signedValuesResponse.error) {
              console.error(`API returned error for action ${actionIndex}`, {
                requestId,
                error: signedValuesResponse.error,
                message: signedValuesResponse.message || "No error message provided",
              });
              throw new Error(signedValuesResponse.message || "API request failed");
            }

            // Extract all needed values from signedValuesResponse
            const {
              token_id,
              serviceprovider_id,
              serviceprovider_signature,
              serviceprovider_public_key_base64url,
              fee_signature,
            } = signedValuesResponse;

            // Construct the RODiT data for verification
            const signedValuesToMint = {
              token_id: token_id,
              openapijson_url: params.tamperproofedValues.openapijson_url,
              not_after: params.serverValues.notafter,
              not_before: params.providerSelectedValues.notbefore,
              max_requests: String(params.userSelectedValues.maxrequests),
              maxrq_window: String(params.userSelectedValues.maxrqwindow),
              webhook_cidr: params.tamperproofedValues.webhook_cidr,
              allowed_cidr: params.tamperproofedValues.allowed_cidr,
              allowed_iso3166list:
                params.tamperproofedValues.allowed_iso3166list,
              jwt_duration: params.tamperproofedValues.jwt_duration,
              permissioned_routes:
                params.tamperproofedValues.permissioned_routes,
              subjectuniqueidentifier_url:
                params.serverValues.subjectuniqueidentifierurl,
              serviceprovider_id: serviceprovider_id,
              serviceprovider_signature: serviceprovider_signature,
              webhook_url: validateAndSetUrl(params.userSelectedValues.webhookurl),
              userselected_dn: params.userSelectedValues.userselecteddn
            };

            const SignerPublicKey = bufferUtils.base64urlToUint8Array(
              serviceprovider_public_key_base64url
            );

            const verificationResult = await verifyRoditBeforeMinting(
              signedValuesToMint, // Pass the complete object instead of destructuring with ...VerificationMetadata
              SignerPublicKey, "server"
            );

            if (!verificationResult) {
              throw new Error("RODiT pair verification failed - aborting mint");
            }

            console.debug(`Building action ${actionIndex} with signed values`, {
              requestId,
              tokenId: token_id,
              serviceproviderId: serviceprovider_id,
              hasServiceProviderId: !!serviceprovider_id,
              hasSignature: !!serviceprovider_signature,
              hasFeeSignature: !!fee_signature,
            });

            try {
              // Create fee data object
              const FeeData = {
                token_id: token_id,
                mintingfee: params.providerSelectedValues.mintingfee,
                mintingfeeaccount: params.providerSelectedValues.mintingfeeaccount
              };
              
              // Serialize FeeData to JSON string
              const fee_data_json = JSON.stringify(FeeData);
              
              // When constructing the minting action
              const action = {
                type: "FunctionCall",
                params: {
                  methodName: "rodit_mint",
                  args: {
                    token_id: token_id,
                    metadata: {
                      // Use the already validated tamperproofedValues
                      openapijson_url:
                        params.tamperproofedValues.openapijson_url,
                      not_after: params.tamperproofedValues.not_after,
                      not_before: params.tamperproofedValues.not_before,
                      max_requests: String(params.tamperproofedValues.max_requests),
                      maxrq_window: String(params.tamperproofedValues.maxrq_window),
                      webhook_cidr: params.tamperproofedValues.webhook_cidr,
                      allowed_cidr: params.tamperproofedValues.allowed_cidr,
                      allowed_iso3166list:
                        params.tamperproofedValues.allowed_iso3166list,
                      jwt_duration: params.tamperproofedValues.jwt_duration,
                      permissioned_routes:
                        params.tamperproofedValues.permissioned_routes,
                      subjectuniqueidentifier_url:
                        params.tamperproofedValues.subjectuniqueidentifier_url,

                      // Add the fields not included in tamperproofedValues
                      webhook_url: validateAndSetUrl(
                        params.userSelectedValues.webhookurl
                      ),
                      userselected_dn: params.userSelectedValues.userselecteddn,
                      serviceprovider_id: serviceprovider_id,
                      serviceprovider_signature: validateAndSetSignature(
                        serviceprovider_signature,
                        "digital signature"
                      ),
                    },
                    owneraccount_id: params.serverValues.owneraccountid,
                    mintingfee_account:
                      params.providerSelectedValues.mintingfeeaccount,
                    mintingfee_value: params.providerSelectedValues.mintingfee,
                    fee_data_json: fee_data_json,
                    fee_signature_base64url: fee_signature,
                  },
                  gas: params.gas,
                  deposit: params.deposit,
                },
              };

              console.debug(`Created action ${actionIndex}`, {
                requestId,
                actionType: action.type,
                methodName: action.params.methodName,
                tokenId: action.params.args.token_id,
                hasMetadata: !!action.params.args.metadata,
                gas: action.params.gas,
                deposit: action.params.deposit,
              });

              return action;
            } catch (actionCreationError) {
              console.error(`Failed to create action ${actionIndex}`, {
                requestId,
                error: actionCreationError.message,
                stack: actionCreationError.stack,
              });
              throw new Error(
                `Failed to create action: ${actionCreationError.message}`
              );
            }
          }
        )
      );

      console.debug("Action set created successfully", {
        requestId,
        actionCount: actionset.length,
        contractId: this.contractId,
      });

      // Call contract method
      console.debug("Calling contract method", {
        requestId,
        contractId: this.contractId,
        actionCount: actionset.length,
        firstActionMethod: actionset[0]?.params?.methodName,
      });

      try {
        await this.wallet.callMethod(this.contractId, actionset);
        console.debug("Contract call completed successfully", { requestId });
      } catch (contractError) {
        console.error("Contract call failed", {
          requestId,
          error: contractError.message,
          stack: contractError.stack,
          errorType: contractError.constructor.name,
        });
        throw contractError;
      }

      // Clean up session storage
      sessionStorage.removeItem("mintParams");
      console.debug("Cleaned up session storage", { requestId });

      return { success: true };
    } catch (error) {
      console.error("Mint resumption failed", {
        requestId,
        error: error.message,
        stack: error.stack,
        errorType: error.constructor.name,
      });
      throw error;
    }
  }
}
