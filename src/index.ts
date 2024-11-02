import {
    NearBindgen,
    call,
    view,
    LookupMap,
    UnorderedMap,
    initialize,
    assert, near, UnorderedSet
  } from "near-sdk-js";
  
  export const RODIT_METADATA_SPEC = "RODIT-near.org-1.09.73";
  export const RODIT_STANDARD_NAME = "PENDING nepXXX";
  
  @NearBindgen({})
  export class Contract {
    owner_id: string;
    tokensPerOwner: LookupMap;
    tokensById: LookupMap;
    tokenMetadataById: UnorderedMap;
    metadata: RoditContractMetadata;
  
    constructor() {
      this.owner_id = "";
      this.tokensPerOwner = new LookupMap("tokensPerOwner");
      this.tokensById = new LookupMap("tokensById");
      this.tokenMetadataById = new UnorderedMap("tokenMetadataById");
      this.metadata = {
        versionnumber: "RODIT-near.org-1.09.73",
        name: "Cableguard API forge",
        symbol: "RODIT",
        issueruniqueidentifierURL: "10973-cableguard.org",
      };
    }
  
    @initialize({})
    init({ owner_id, metadata = {
      versionnumber: "RODIT-near.org-1.09.73",
      name: "Cableguard API forge",
      symbol: "RODIT",
      issueruniqueidentifierURL: "10973-cableguard.org",
    }}) {
      this.owner_id = owner_id;
      this.metadata = metadata;
    }
  
    @call({})
    rodit_mint({
      token_id,
      openapijson_url,
      not_after,
      not_before,
      max_requests,
      maxrq_window,
      webhook_url,
      webhook_cidr,
      userselected_dn,
      allowed_cidr,
      allowed_iso3166list,
      jwt_duration,
      permissioned_routes,
      subjectuniqueidentifier_url,
      serviceprovider_id,
      serviceprovider_signature,
      owneraccount_id,
      mintingfee_account,
    }) {
      const metadata = new TokenMetadata(
        openapijson_url,
        not_after,
        not_before,
        max_requests,
        maxrq_window,
        webhook_url,
        webhook_cidr,
        userselected_dn,
        allowed_cidr,
        allowed_iso3166list,
        jwt_duration,
        permissioned_routes,
        subjectuniqueidentifier_url,
        serviceprovider_id,
        serviceprovider_signature,
      );
      return internalMint(this, token_id, metadata, owneraccount_id, mintingfee_account);
    }
  
    @view({})
    rodit_token({ token_id }) {
      return internalRoditToken({ contract: this, tokenId: token_id });
    }
  
    @call({})
    rodit_transfer({ receiver_id, token_id, memo }) {
      return internalRoditTransfer({
        contract: this,
        receiverId: receiver_id,
        tokenId: token_id,
        memo: memo,
      });
    }
  
    @view({})
    rodit_total_supply() {
      return internalTotalSupply({ contract: this });
    }
  
    @view({})
    rodit_tokens({ from_index, limit }) {
      return internalroditTokens({
        contract: this,
        fromIndex: from_index,
        limit: limit,
      });
    }
  
    @view({})
    rodit_tokens_for_owner({ account_id, from_index, limit }) {
      return internalTokensForOwner({
        contract: this,
        accountId: account_id,
        fromIndex: from_index,
        limit: limit,
      });
    }
  
    @view({})
    rodit_supply_for_owner({ account_id }) {
      return internalSupplyForOwner({ contract: this, accountId: account_id });
    }
  
    @view({})
    rodit_metadata() {
      return internalRoditMetadata({ contract: this });
    }
  }
  
  class RoditContractMetadata {
    versionnumber: string;
    name: string;
    symbol: string;
    issueruniqueidentifierURL?: string;
  
    constructor({
      versionnumber,
      name,
      symbol,
      baseUri,
    }: {
      versionnumber: string;
      name: string;
      symbol: string;
      baseUri?: string;
    }) {
      this.versionnumber = versionnumber;
      this.name = name;
      this.symbol = symbol;
      this.issueruniqueidentifierURL = baseUri;
    }
  }
  
  class TokenMetadata {
    openapijsonurl?: string;
    notafter?: string;
    notbefore?: string;
    maxrequests?: string;
    maxrqwindow?: string;
    webhook_url?: string;
    webhook_cidr?: string;
    userselected_dn?: string; // user choice: User ID, organization ID / Tenant ID
    allowed_cidr?: string;
    allowed_iso3166list?: string;
    jwtduration?: string;
    permissionedroutes: string;
    subjectuniqueidentifierurl?: string;
    serviceproviderid?: string;
    serviceprovidersignature?: string;
  
  
    constructor(
      openapijson_url?: string,
      not_after?: string,
      not_before?: string,
      max_requests?: string,
      maxrq_window?: string,
      webhook_url?: string,
      webhook_cidr?: string,
      userselected_dn?: string, // user choice: User ID, organization ID / Tenant ID
      allowed_cidr?: string,
      allowed_iso3166list?: string,
      jwt_duration?: string,
      permissioned_routes?: string,
      subjectuniqueidentifier_url?: string,
      serviceprovider_id?: string,
      serviceprovider_signature?: string
    ) {
      this.validateAndSetUrl(openapijson_url, "openapijsonurl");
      this.validateAndSetDate(not_after, "notafter");
      this.validateAndSetDate(not_before, "notbefore");
      this.validateAndSetInteger(max_requests, "maxrequests");
      this.validateAndSetInteger(maxrq_window, "maxrqwindow");
      this.validateAndSetUrl(webhook_url, "webhookurl");
      this.validateAndSetCIDR(webhook_cidr, "webhookcidr");
      this.validateAndSetDN(userselected_dn, "userselected_dn"); // user choice: User ID, organization ID / Tenant ID
      this.validateAndSetCIDR(allowed_cidr, "allowed_cidr");
      this.validateAndSetiso3166Codes(allowed_iso3166list, "allowediso3166list");
      this.validateAndSetInteger(jwt_duration, "jwtduration");
      this.validateAndSetJson(permissioned_routes, "permissionedroutes");
      this.validateAndSetUrl(
        subjectuniqueidentifier_url,
        "subjectuniqueidentifierurl"
      );
      this.serviceproviderid = serviceprovider_id;
      this.validateAndSetSignature(
        serviceprovider_signature,
        "serviceprovidersignature"
      );
    }
  
    private validateAndSetUrl(value: string | undefined, field: string): void {
      if (value) {
        const urlPattern =
          /^(https?:\/\/)?(localhost|[\da-z\.-]+|\[[\da-f:]+\]|(?:\d{1,3}\.){3}\d{1,3})(:(\d{1,5}))?(\/.*)?$/i;
        if (!urlPattern.test(value)) {
          throw new Error(`Invalid URL for ${field}: ${value}`);
        }
        this[field] = value;
      }
    }
  
    private validateAndSetiso3166Codes(
      value: string | undefined,
      field: string
    ): void {
      if (value) {
        try {
          // Parse the JSON string
          const parsedValue = JSON.parse(value);
  
          // Check if the parsed value is an object
          if (
            typeof parsedValue !== "object" ||
            parsedValue === null ||
            Array.isArray(parsedValue)
          ) {
            throw new Error("Invalid JSON format: expected an object");
          }
  
          // Regular expression for ISO 3166-1 alpha-3 codes
          const iso3166Alpha3Regex = /^[A-Z]{3}$/;
  
          // If all validations pass, set the value
          this[field] = value;
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(
              `Invalid country codes JSON for ${field}: ${error.message}`
            );
          } else {
            throw new Error(`Invalid country codes JSON for ${field}`);
          }
        }
      }
    }
  
    private validateAndSetDN(value: string | undefined, field: string): void {
      if (value) {
        // Regular expression for basic DN format
        const dnPattern =
          /^(?:(?:CN|OU|DC|O|C|L|ST)=[^,]+,)*(?:CN|OU|DC|O|C|L|ST)=[^,]+$/i;
  
        if (!dnPattern.test(value)) {
          throw new Error(
            `Invalid Distinguished Name (DN) for ${field}: ${value}`
          );
        }
  
        // Additional validation for individual RDNs
        const rdns = value.split(",");
        for (const rdn of rdns) {
          const [attr, val] = rdn.trim().split("=");
          if (!attr || !val) {
            throw new Error(`Invalid RDN in DN for ${field}: ${rdn}`);
          }
  
          // Check for common attributes (non-exhaustive list)
          if (!/^(CN|OU|DC|O|C|L|ST)$/i.test(attr)) {
            throw new Error(
              `Unsupported attribute type in DN for ${field}: ${attr}`
            );
          }
  
          // Additional checks could be added here for specific attribute values
          // For example, country codes should be 2 letters, etc.
        }
  
        this[field] = value;
      }
    }
  
    private validateAndSetCIDR(value: string | undefined, field: string): void {
      if (value) {
        const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!cidrPattern.test(value)) {
          throw new Error(`Invalid CIDR for ${field}: ${value}`);
        }
  
        // Additional validation for IP address and subnet mask
        const [ip, subnet] = value.split("/");
        const ipParts = ip.split(".").map(Number);
        const subnetNum = Number(subnet);
  
        if (
          ipParts.some((part) => part < 0 || part > 255) ||
          subnetNum < 0 ||
          subnetNum > 32
        ) {
          throw new Error(`Invalid CIDR for ${field}: ${value}`);
        }
  
        this[field] = value;
      }
    }
  
    private validateAndSetDate(value: string | undefined, field: string): void {
      if (value) {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (
          !datePattern.test(value) ||
          new Date(value).toString() === "Invalid Date" ||
          new Date(value) < new Date("1970-01-01")
        ) {
          throw new Error(
            `Invalid date for ${field}: ${value}. Must be YYYY-MM-DD and no earlier than 1970-01-01`
          );
        }
        this[field] = value;
      }
    }
  
    private validateAndSetInteger(
      value: string | undefined,
      field: string
    ): void {
      if (value !== undefined) {
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || String(intValue) !== value || intValue < 0) {
          throw new Error(`Invalid positive integer for ${field}: ${value}`);
        }
        this[field] = intValue; // Store as number instead of string
      }
    }
  
    private validateAndSetJson(value: string | undefined, field: string): void {
      if (!value) {
        throw new Error(`${field} is required and must be a valid JSON string`);
      }
      
      try {
        // Parse the JSON string to verify it's valid
        const parsedJson = JSON.parse(value);
        
        // Store the original string, not a re-stringified version
        this[field] = value;
      } catch (e) {
        throw new Error(`Invalid JSON for ${field}: ${value}`);
      }
    }
    
    private validateAndSetSignature(
      value: string | undefined,
      field: string
    ): void {
      if (value) {
        const base64urlPattern = /^[A-Za-z0-9_-]+$/;
        if (!base64urlPattern.test(value)) {
          throw new Error(`Invalid base64url encoding for ${field}: ${value}`);
        }
        if (value.length !== 86) {
          throw new Error(
            `Invalid signature length for ${field}: ${value}. Expected 88 characters for Ed25519 signature.`
          );
        }
        this[field] = value;
      }
    }
  }
  
  export class Token {
    owner_id: string;
  
    constructor({ ownerId }: { ownerId: string }) {
      this.owner_id = ownerId;
    }
  }
  
  export class JsonToken {
    token_id: string;
    owner_id: string;
    metadata: TokenMetadata;
  
    constructor({
      tokenId,
      ownerId,
      metadata,
    }: {
      tokenId: string;
      ownerId: string;
      metadata: TokenMetadata;
    }) {
      this.token_id = tokenId;
      this.owner_id = ownerId;
      this.metadata = metadata;
    }
  }
  
  export function internalRoditMetadata({
    contract,
  }: {
    contract: Contract;
  }): RoditContractMetadata {
    return contract.metadata;
  }
  
  // Gets a collection and deserializes it into a set that can be used.
  export function restoreOwners(collection) {
    if (collection == null) {
      return null;
    }
    return UnorderedSet.deserialize(collection as UnorderedSet);
  }
  
  export function initAccountcollectFeepayProvider(
    storageUsed: bigint,
    implicitAccountId: string,
    mintingFeeAccount: string,
  ): void {
    const requiredCost = storageUsed * near.storageByteCost().valueOf();
    const mintingFee = near.attachedDeposit().valueOf();
    assert(
      requiredCost <= mintingFee,
      `Must attach at least ${requiredCost} yoctoNEAR to cover storage and fee`
    );
  
    const initializeFee = BigInt(' 100000000000000000000'); // 0.0001 NEAR contract fee
      // Create a promise to initialize the recipient account
    const initializeFeePromise = near.promiseBatchCreate(implicitAccountId);
    near.promiseBatchActionTransfer(initializeFeePromise, initializeFee);
  
    const divisor = BigInt(100);
    const contractFee = (mintingFee - requiredCost -initializeFee) / divisor; // 0.1 NEAR contract fee
    const remainingBalance = mintingFee - requiredCost - contractFee - initializeFee;
  
    near.log(`Initializing ${implicitAccountId} with ${initializeFee} yoctoNEAR`);
    near.log(`Contract collecting fee ${contractFee} yoctoNEAR`);
    near.log(`Sending provider ${mintingFeeAccount} API fee of ${remainingBalance} yoctoNEAR`);
  
    // Create a promise to transfer the contract fee
    const contractFeePromise = near.promiseBatchCreate(near.currentAccountId());
    near.promiseBatchActionTransfer(contractFeePromise, contractFee);
  
    // If there's a remaining balance, create a promise to transfer it to the minting fee account
    if (remainingBalance > 0) {
      const mintingFeePromise = near.promiseBatchCreate(mintingFeeAccount);
      near.promiseBatchActionTransfer(mintingFeePromise, remainingBalance);
    }
  }
  
  //add a token to the set of tokens an owner has
  export function internalAddTokenToOwner(
    contract: Contract,
    accountId: string,
    tokenId: string
  ) {
    let tokenSet = restoreOwners(contract.tokensPerOwner.get(accountId));
  
    if (tokenSet == null) {
      tokenSet = new UnorderedSet("tokensPerOwner" + accountId.toString());
    }
  
    tokenSet.set(tokenId);
    contract.tokensPerOwner.set(accountId, tokenSet);
  }
  
  //remove a token from an owner (internal method and can't be called directly via CLI).
  export function internalRemoveTokenFromOwner(
    contract: Contract,
    accountId: string,
    tokenId: string
  ) {
    let tokenSet = restoreOwners(contract.tokensPerOwner.get(accountId));
    if (tokenSet == null) {
      near.panicUtf8("Token should be owned by the sender");
    }
  
    tokenSet.remove(tokenId);
  
    if (tokenSet.isEmpty()) {
      contract.tokensPerOwner.remove(accountId);
    } else {
      contract.tokensPerOwner.set(accountId, tokenSet);
    }
  }
  
  //transfers the RODIT to the receiver_id (internal method and can't be called directly via CLI).
  export function internalTransfer(
    contract: Contract,
    senderId: string,
    receiverId: string,
    tokenId: string,
    memo: string
  ): Token {
    let token = contract.tokensById.get(tokenId) as Token;
    if (token == null) {
      near.panicUtf8("no token found");
    }
  
    assert(
      senderId === token.owner_id,
      "Unauthorized: only token owner can transfer"
    );
  
    assert(
      token.owner_id != receiverId,
      "The token owner and the receiver should be different"
    );
  
    internalRemoveTokenFromOwner(contract, token.owner_id, tokenId);
    internalAddTokenToOwner(contract, receiverId, tokenId);
  
    let newToken = new Token({
      ownerId: receiverId,
    });
  
    contract.tokensById.set(tokenId, newToken);
  
    if (memo != null) {
      near.log(`Memo: ${memo}`);
    }
  
    let roditTransferLog = {
      standard: RODIT_STANDARD_NAME,
      version: RODIT_METADATA_SPEC,
      event: "rodit_transfer",
      data: [
        {
          old_owner_id: token.owner_id,
          new_owner_id: receiverId,
          token_ids: [tokenId],
          memo,
        },
      ],
    };
  
    near.log(JSON.stringify(roditTransferLog));
  
    return token;
  }
  
  export function internalMint(
    contract: Contract,
    tokenId: string,
    metadata: TokenMetadata,
    receiverId: string,
    mintingfeeaccount: string,
  ): void {
    // Measure the initial storage being used on the contract
    let initialStorageUsage = near.storageUsage();
  
    // Specify the token struct that contains the owner ID
    let token = new Token({
      ownerId: receiverId,
    });
  
    // Insert the token ID and token struct and make sure that the token doesn't exist
    assert(!contract.tokensById.containsKey(tokenId), "RODIT already exists");
    contract.tokensById.set(tokenId, token);
  
    // Insert the token ID and metadata
    contract.tokenMetadataById.set(tokenId, metadata);
  
    // Call the internal method for adding the token to the owner
    internalAddTokenToOwner(contract, token.owner_id, tokenId);
  
    // Construct the mint log as per the events standard.
    let roditMintLog = {
      standard: RODIT_STANDARD_NAME,
      version: RODIT_METADATA_SPEC,
      event: "rodit_mint",
      data: [
        {
          owner_id: token.owner_id,
          token_ids: [tokenId],
        },
      ],
    };
  
    // Log the json.
    near.log(`EVENT_JSON:${JSON.stringify(roditMintLog)}`);
  
    // Calculate the required storage
    let requiredStorageInBytes =
      near.storageUsage().valueOf() - initialStorageUsage.valueOf();
  
    // Collect the storage deposit
  
    initAccountcollectFeepayProvider(requiredStorageInBytes, receiverId, mintingfeeaccount);
  }
  
  // Get the information for a specific token ID
  export function internalRoditToken({
    contract,
    tokenId,
  }: {
    contract: Contract;
    tokenId: string;
  }) {
    let token = contract.tokensById.get(tokenId) as Token;
    if (token == null) {
      return null;
    }
  
    let metadata = contract.tokenMetadataById.get(tokenId) as TokenMetadata;
  
    let jsonToken = new JsonToken({
      tokenId: tokenId,
      ownerId: token.owner_id,
      metadata,
    });
    return jsonToken;
  }
  
  // Implementation of the rodit_transfer method. This transfers the RODIT from the current owner to the receiver.
  export function internalRoditTransfer({
    contract,
    receiverId,
    tokenId,
    memo,
  }: {
    contract: Contract;
    receiverId: string;
    tokenId: string;
    memo: string;
  }) {
    let token = contract.tokensById.get(tokenId) as Token;
    assert(token != null, "No token found");
    assert(token.owner_id === near.predecessorAccountId(), "Unauthorized");
  
    internalRemoveTokenFromOwner(contract, token.owner_id, tokenId);
    internalAddTokenToOwner(contract, receiverId, tokenId);
  
    token.owner_id = receiverId;
    contract.tokensById.set(tokenId, token);
  
    // Construct the transfer log as per the events standard.
    let roditTransferLog = {
      standard: RODIT_STANDARD_NAME,
      version: RODIT_METADATA_SPEC,
      event: "rodit_transfer",
      data: [
        {
          old_owner_id: near.predecessorAccountId(),
          new_owner_id: receiverId,
          token_ids: [tokenId],
          memo,
        },
      ],
    };
  
    near.log(JSON.stringify(roditTransferLog));
  }
  
  //Query for the total supply of RODITs on the contract
  export function internalTotalSupply({
    contract,
  }: {
    contract: Contract;
  }): number {
    //return the length of the token metadata by ID
    return contract.tokenMetadataById.length;
  }
  
  //Query for RODiT tokens on the contract regardless of the owner using pagination
  export function internalroditTokens({
    contract,
    fromIndex,
    limit,
  }: {
    contract: Contract;
    fromIndex?: string;
    limit?: number;
  }): JsonToken[] {
    let tokens = [];
  
    //where to start pagination - if we have a fromIndex, we'll use that - otherwise start from 0 index
    let start = fromIndex ? parseInt(fromIndex) : 0;
    //take the first "limit" elements in the array. If we didn't specify a limit, use 50
    let max = limit ? limit : 50;
  
    let keys = contract.tokenMetadataById.toArray();
    // Paginate through the keys using the fromIndex and limit
    for (let i = start; i < keys.length && i < start + max; i++) {
      // get the token object from the keys
      let jsonToken = internalRoditToken({ contract, tokenId: keys[i][0] });
      tokens.push(jsonToken);
    }
    return tokens;
  }
  
  //get the total supply of RODITs for a given owner
  export function internalSupplyForOwner({
    contract,
    accountId,
  }: {
    contract: Contract;
    accountId: string;
  }): number {
    //get the set of tokens for the passed in owner
    let tokens = restoreOwners(contract.tokensPerOwner.get(accountId));
    //if there isn't a set of tokens for the passed in account ID, we'll return 0
    if (tokens == null) {
      return 0;
    }
  
    //if there is some set of tokens, we'll return the length
    return tokens.length;
  }
  
  //Query for all the tokens for an owner
  export function internalTokensForOwner({
    contract,
    accountId,
    fromIndex,
    limit,
  }: {
    contract: Contract;
    accountId: string;
    fromIndex?: string;
    limit?: number;
  }): JsonToken[] {
    //get the set of tokens for the passed in owner
    let tokenSet = restoreOwners(contract.tokensPerOwner.get(accountId));
  
    //if there isn't a set of tokens for the passed in account ID, we'll return 0
    if (tokenSet == null) {
      return [];
    }
    
    //where to start pagination - if we have a fromIndex, we'll use that - otherwise start from 0 index
    let start = fromIndex ? parseInt(fromIndex) : 0;
    //take the first "limit" elements in the array. If we didn't specify a limit, use 50
    let max = limit ? limit : 50;
  
    let keys = tokenSet.toArray();
    let tokens: JsonToken[] = [];
    for (let i = start; i < max; i++) {
      if (i >= keys.length) {
        break;
      }
      let token = internalRoditToken({ contract, tokenId: keys[i] });
      tokens.push(token);
    }
    return tokens;
  }
  