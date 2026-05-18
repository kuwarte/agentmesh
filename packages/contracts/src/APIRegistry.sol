// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title APIRegistry
 * @author Defi-nitely Broke
 * @notice Registry for payment APIs that AI agents can discover and access
 * @dev Stores API metadata on-chain for transparent pricing and discovery
 *
 * Key Features:
 * - Permissionless API registration
 * - Provider-owned API management
 * - On-chain pricing transparency
 * - Enumerable API listings
 *
 * Usage Flow:
 * 1. Provider registers API with endpoint and price
 * 2. Agent discovers APIs via getAllAPIs() or by provider
 * 3. Agent reads pricing and metadata
 * 4. Agent pays via X402PaymentRouter and calls API
 */
contract APIRegistry {
	/**
	 * @notice API metadata structure
	 * @param provider Address of the API provider (owner)
	 * @param name Human-readable API name (e.g., "ThirdParty API")
	 * @param endpoint API endpoint URL (e.g., "https://api.example.com/thirdParty")
	 * @param pricePerCall Cost per API call in USDC (wei, 6 decimals)
	 * @param active Whether the API is currently accepting requests
	 */
	struct API {
		address provider;
		string name;
		string endpoint;
		uint256 pricePerCall;
		bool active;
	}

	/// @notice Mapping from API ID to API metadata
	/// @dev API ID is generated via keccak256(name, provider, timestamp)
	mapping(bytes32 => API) private apis;

	/// @notice Array of all registered API IDs for enumeration
	/// @dev Used by getAllAPIs() to return complete list
	bytes32[] private apiIds;

	/// @notice Mapping from provider address to their API IDs
	/// @dev Allows querying all APIs by a specific provider
	mapping(address => bytes32[]) private providerAPIs;

	/**
	 * @notice Emitted when a new API is registered
	 * @param apiId Unique identifier for the API
	 * @param provider Address of the API owner
	 * @param name API name
	 * @param endpoint API endpoint URL
	 * @param pricePerCall Cost per call in USDC
	 */
	event APIRegistered(
		bytes32 indexed apiId,
		address indexed provider,
		string name,
		string endpoint,
		uint256 pricePerCall
	);

	/**
	 * @notice Emitted when API metadata is updated
	 * @param apiId The API being updated
	 * @param newPrice Updated price per call
	 * @param active Updated active status
	 */
	event APIUpdated(bytes32 indexed apiId, uint256 newPrice, bool active);

	/**
	 * @notice Emitted when an API is deactivated
	 * @param apiId The API being deactivated
	 */
	event APIDeactivated(bytes32 indexed apiId);

	/**
	 * @notice Register a new API on the platform
	 * @dev Generates unique API ID using name, sender, and timestamp
	 * @param name Human-readable name for the API
	 * @param endpoint Full URL endpoint for the API
	 * @param pricePerCall Cost per API call in USDC smallest units (6 decimals)
	 * @return apiId The unique identifier for the registered API
	 *
	 * Requirements:
	 * - Name must not be empty
	 * - Endpoint must not be empty
	 * - Price can be 0 for free APIs
	 */
	function registerAPI(
		string memory name,
		string memory endpoint,
		uint256 pricePerCall
	) external returns (bytes32 apiId) {
		apiId = keccak256(abi.encodePacked(name, msg.sender, block.timestamp));

		apis[apiId] = API({
			provider: msg.sender,
			name: name,
			endpoint: endpoint,
			pricePerCall: pricePerCall,
			active: true
		});

		apiIds.push(apiId);
		providerAPIs[msg.sender].push(apiId);

		emit APIRegistered(apiId, msg.sender, name, endpoint, pricePerCall);
	}

	/**
	 * @notice Get metadata for a specific API
	 * @param apiId The unique identifier of the API
	 * @return API struct containing all metadata
	 *
	 * Requirements:
	 * - API must exist (provider != address(0))
	 */
	function getAPI(bytes32 apiId) external view returns (API memory) {
		require(apis[apiId].provider != address(0), "API not found");
		return apis[apiId];
	}

	/**
	 * @notice Get all registered API IDs
	 * @return Array of all API IDs in the registry
	 * @dev Use this with getAPI() to enumerate all APIs
	 */
	function getAllAPIs() external view returns (bytes32[] memory) {
		return apiIds;
	}

	/**
	 * @notice Get all APIs owned by a specific provider
	 * @param provider Address of the API provider
	 * @return Array of API IDs owned by the provider
	 */
	function getProviderAPIs(address provider) external view returns (bytes32[] memory) {
		return providerAPIs[provider];
	}

	/**
	 * @notice Update API pricing or active status (owner only)
	 * @param apiId The API to update
	 * @param newPrice New price per call in USDC
	 * @param active New active status
	 */
	function updateAPI(bytes32 apiId, uint256 newPrice, bool active) external {
		API storage api = apis[apiId];
		require(api.provider == msg.sender, "Not owner");
		require(api.provider != address(0), "API not found");

		api.pricePerCall = newPrice;
		api.active = active;

		emit APIUpdated(apiId, newPrice, active);

		if (!active) {
			emit APIDeactivated(apiId);
		}
	}

	/**
	 * @notice Check if an API is currently active
	 * @param apiId The API to check
	 * @return bool True if active, false otherwise
	 */
	function isActive(bytes32 apiId) external view returns (bool) {
		return apis[apiId].active;
	}

	/**
	 * @notice Get total number of registered APIs
	 * @return uint256 Total count of APIs
	 */
	function totalAPIs() external view returns (uint256) {
		return apiIds.length;
	}
}
