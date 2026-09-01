// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ReputationSystem - TrustLayer
/// @notice On-chain reputation system for BOT Chain. Registered users rate
///         other registered addresses 1-5 stars with text reviews, building
///         an aggregate reputation score per address.
contract ReputationSystem is Ownable, ReentrancyGuard, Pausable {
    struct Profile {
        uint256 totalRatings; // number of ratings this user has RECEIVED
        uint256 ratingSum; // sum of all ratings received
        uint256 reviewCount; // number of reviews this user has WRITTEN
        bool exists;
    }

    /// @notice Aggregate reputation profile for each address.
    mapping(address => Profile) public profiles;

    /// @notice Tracks whether `reviewer` has already reviewed `target`.
    mapping(address => mapping(address => bool)) public hasReviewed;

    /// @notice Fee (in wei) required to submit a review.
    uint256 public reviewFee = 0.001 ether;

    event ProfileRegistered(address user);
    event ReviewSubmitted(
        address indexed reviewer,
        address indexed target,
        uint8 rating,
        string comment
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Register a reputation profile for the caller.
    function registerProfile() external {
        require(!profiles[msg.sender].exists, "ReputationSystem: already registered");
        profiles[msg.sender] = Profile({
            totalRatings: 0,
            ratingSum: 0,
            reviewCount: 0,
            exists: true
        });
        emit ProfileRegistered(msg.sender);
    }

    /// @notice Submit a 1-5 star review with a comment for `_target`.
    /// @dev Reverts on self-review, invalid rating, unregistered reviewer or
    ///      target, a duplicate review from the same reviewer/target pair,
    ///      or an insufficient fee.
    function submitReview(
        address _target,
        uint8 _rating,
        string calldata _comment
    ) external payable whenNotPaused nonReentrant {
        require(msg.value >= reviewFee, "ReputationSystem: insufficient fee");
        require(_target != msg.sender, "ReputationSystem: cannot review yourself");
        require(_rating >= 1 && _rating <= 5, "ReputationSystem: rating must be 1-5");
        require(profiles[msg.sender].exists, "ReputationSystem: reviewer not registered");
        require(profiles[_target].exists, "ReputationSystem: target not registered");
        require(
            !hasReviewed[msg.sender][_target],
            "ReputationSystem: already reviewed this address"
        );

        hasReviewed[msg.sender][_target] = true;

        Profile storage targetProfile = profiles[_target];
        targetProfile.totalRatings += 1;
        targetProfile.ratingSum += _rating;

        Profile storage reviewerProfile = profiles[msg.sender];
        reviewerProfile.reviewCount += 1;

        emit ReviewSubmitted(msg.sender, _target, _rating, _comment);
    }

    /// @notice Returns the average rating and rating count for `_user`.
    /// @return avg Integer average rating (ratingSum / totalRatings), 0 if no ratings.
    /// @return count Number of ratings received.
    function getAverageRating(address _user) external view returns (uint256 avg, uint256 count) {
        Profile memory profile = profiles[_user];
        count = profile.totalRatings;
        avg = profile.totalRatings == 0 ? 0 : profile.ratingSum / profile.totalRatings;
    }

    /// @notice Returns the full reputation profile for `_user`.
    function getProfile(address _user) external view returns (Profile memory) {
        return profiles[_user];
    }

    /// @notice Update the fee required to submit a review. Only callable by the owner.
    function setReviewFee(uint256 _newFee) external onlyOwner {
        reviewFee = _newFee;
    }

    /// @notice Withdraw the contract's accumulated fees to the owner.
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "ReputationSystem: no fees to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "ReputationSystem: withdrawal failed");
    }

    /// @notice Pause review submissions. Only callable by the owner.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume review submissions. Only callable by the owner.
    function unpause() external onlyOwner {
        _unpause();
    }
}
