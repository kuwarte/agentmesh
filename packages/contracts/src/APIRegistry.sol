// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract APIRegistry {
	struct API {
		address provider;
		string name;
		string endpoint;
		uint256 pricePerCall;
		bool active;
	}

	mapping(bytes32 => API) private apis;

	bytes32[] private apiIds;

	mapping(address => bytes32[]) private providerAPIs;

	event APIRegistered(
		bytes32 indexed apiId,
		address indexed provider,
		string name,
		string endpoint,
		uint256 pricePerCall
	);

	event APIUpdated(bytes32 indexed apiId, uint256 newPrice, bool active);

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

	function getAPI(bytes32 apiId) external view returns (API memory) {
		require(apis[apiId].provider != address(0), "API not found");
		return apis[apiId];
	}

	function getAllAPIs() external view returns (bytes32[] memory) {
		return apiIds;
	}

	function getProviderAPIs(address provider) external view returns (bytes32[] memory) {
		return providerAPIs[provider];
	}

	function updateAPI(bytes32 apiId, uint256 newPrice, bool active) external {
		API storage api = apis[apiId];

		require(api.provider == msg.sender, "Not owner");
		require(api.provider != address(0), "API not found");

		api.pricePerCall = newPrice;
		api.active = active;

		emit APIUpdated(apiId, newPrice, active);
	}

	function isActive(bytes32 apiId) external view returns (bool) {
		return apis[apiId].active;
	}

	function totalAPIs() external view returns (uint256) {
		return apiIds.length;
	}
}
