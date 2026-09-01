const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReputationSystem", function () {
  let reputationSystem;
  let owner, alice, bob, carol;
  let reviewFee;

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ReputationSystem");
    reputationSystem = await Factory.deploy();
    await reputationSystem.waitForDeployment();
    reviewFee = await reputationSystem.reviewFee();
  });

  async function registerAll() {
    await reputationSystem.connect(alice).registerProfile();
    await reputationSystem.connect(bob).registerProfile();
    await reputationSystem.connect(carol).registerProfile();
  }

  describe("Profile registration", function () {
    it("allows a user to register a profile", async function () {
      await expect(reputationSystem.connect(alice).registerProfile())
        .to.emit(reputationSystem, "ProfileRegistered")
        .withArgs(alice.address);

      const profile = await reputationSystem.getProfile(alice.address);
      expect(profile.exists).to.equal(true);
      expect(profile.totalRatings).to.equal(0);
      expect(profile.ratingSum).to.equal(0);
      expect(profile.reviewCount).to.equal(0);
    });

    it("reverts when registering twice", async function () {
      await reputationSystem.connect(alice).registerProfile();
      await expect(
        reputationSystem.connect(alice).registerProfile()
      ).to.be.revertedWith("ReputationSystem: already registered");
    });
  });

  describe("Review submission", function () {
    beforeEach(async function () {
      await registerAll();
    });

    it("allows a registered user to submit a review for another registered address", async function () {
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 5, "Great trader", { value: reviewFee })
      ).to.not.be.reverted;
    });

    it("emits a ReviewSubmitted event with the correct arguments", async function () {
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 4, "Solid work", { value: reviewFee })
      )
        .to.emit(reputationSystem, "ReviewSubmitted")
        .withArgs(alice.address, bob.address, 4, "Solid work");
    });

    it("updates target totalRatings/ratingSum and reviewer reviewCount", async function () {
      await reputationSystem
        .connect(alice)
        .submitReview(bob.address, 4, "Good", { value: reviewFee });

      const bobProfile = await reputationSystem.getProfile(bob.address);
      expect(bobProfile.totalRatings).to.equal(1);
      expect(bobProfile.ratingSum).to.equal(4);

      const aliceProfile = await reputationSystem.getProfile(alice.address);
      expect(aliceProfile.reviewCount).to.equal(1);
    });
  });

  describe("Validation", function () {
    beforeEach(async function () {
      await registerAll();
    });

    it("reverts on self-review", async function () {
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(alice.address, 5, "Nice try", { value: reviewFee })
      ).to.be.revertedWith("ReputationSystem: cannot review yourself");
    });

    it("reverts when rating is 0", async function () {
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 0, "Bad", { value: reviewFee })
      ).to.be.revertedWith("ReputationSystem: rating must be 1-5");
    });

    it("reverts when rating is above 5", async function () {
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 6, "Too high", { value: reviewFee })
      ).to.be.revertedWith("ReputationSystem: rating must be 1-5");
    });

    it("reverts when reviewer is not registered", async function () {
      const [, , , , dave] = await ethers.getSigners();
      await expect(
        reputationSystem
          .connect(dave)
          .submitReview(bob.address, 5, "Hi", { value: reviewFee })
      ).to.be.revertedWith("ReputationSystem: reviewer not registered");
    });

    it("reverts when target is not registered", async function () {
      const [, , , , dave] = await ethers.getSigners();
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(dave.address, 5, "Hi", { value: reviewFee })
      ).to.be.revertedWith("ReputationSystem: target not registered");
    });

    it("reverts on a duplicate review from the same reviewer to the same target", async function () {
      await reputationSystem
        .connect(alice)
        .submitReview(bob.address, 4, "First", { value: reviewFee });
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 5, "Second", { value: reviewFee })
      ).to.be.revertedWith("ReputationSystem: already reviewed this address");
    });

    it("reverts when the fee is insufficient", async function () {
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 5, "Cheap", { value: reviewFee - 1n })
      ).to.be.revertedWith("ReputationSystem: insufficient fee");
    });
  });

  describe("View functions", function () {
    beforeEach(async function () {
      await registerAll();
    });

    it("computes the correct average rating via getAverageRating", async function () {
      await reputationSystem
        .connect(alice)
        .submitReview(bob.address, 4, "Good", { value: reviewFee });
      await reputationSystem
        .connect(carol)
        .submitReview(bob.address, 2, "Meh", { value: reviewFee });

      const [avg, count] = await reputationSystem.getAverageRating(bob.address);
      expect(count).to.equal(2);
      expect(avg).to.equal(3); // (4 + 2) / 2 = 3
    });

    it("returns zeroed average rating for an address with no reviews", async function () {
      const [avg, count] = await reputationSystem.getAverageRating(carol.address);
      expect(avg).to.equal(0);
      expect(count).to.equal(0);
    });

    it("returns the reviewFee via the public getter", async function () {
      expect(await reputationSystem.reviewFee()).to.equal(ethers.parseEther("0.001"));
    });
  });

  describe("Admin", function () {
    beforeEach(async function () {
      await registerAll();
    });

    it("allows the owner to update the review fee", async function () {
      const newFee = ethers.parseEther("0.002");
      await reputationSystem.connect(owner).setReviewFee(newFee);
      expect(await reputationSystem.reviewFee()).to.equal(newFee);
    });

    it("prevents non-owners from updating the review fee", async function () {
      await expect(
        reputationSystem.connect(alice).setReviewFee(ethers.parseEther("0.002"))
      )
        .to.be.revertedWithCustomError(reputationSystem, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });

    it("allows the owner to pause and blocks new reviews while paused", async function () {
      await reputationSystem.connect(owner).pause();
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 5, "Blocked", { value: reviewFee })
      ).to.be.revertedWithCustomError(reputationSystem, "EnforcedPause");
    });

    it("allows the owner to unpause and resume reviews", async function () {
      await reputationSystem.connect(owner).pause();
      await reputationSystem.connect(owner).unpause();
      await expect(
        reputationSystem
          .connect(alice)
          .submitReview(bob.address, 5, "Resumed", { value: reviewFee })
      ).to.not.be.reverted;
    });

    it("prevents non-owners from pausing", async function () {
      await expect(reputationSystem.connect(alice).pause())
        .to.be.revertedWithCustomError(reputationSystem, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });

    it("allows the owner to withdraw accumulated fees", async function () {
      await reputationSystem
        .connect(alice)
        .submitReview(bob.address, 5, "Nice", { value: reviewFee });

      const before = await ethers.provider.getBalance(owner.address);
      const tx = await reputationSystem.connect(owner).withdrawFees();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(owner.address);

      expect(after).to.equal(before + reviewFee - gasCost);
      expect(await ethers.provider.getBalance(await reputationSystem.getAddress())).to.equal(0);
    });

    it("prevents non-owners from withdrawing fees", async function () {
      await expect(reputationSystem.connect(alice).withdrawFees())
        .to.be.revertedWithCustomError(reputationSystem, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });
  });
});
