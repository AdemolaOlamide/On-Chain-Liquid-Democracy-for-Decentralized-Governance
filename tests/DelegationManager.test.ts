import { describe, it, expect, beforeEach } from "vitest";

interface DelegationHistory {
  delegate: string;
  timestamp: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class DelegationManagerMock {
  state: {
    admin: string;
    maxDepth: number;
    minLockPeriod: number;
    maxHistory: number;
    authorityContract: string | null;
    delegations: Map<string, string | null>;
    delegationTimestamps: Map<string, number>;
    delegationExpirations: Map<string, number>;
    delegationReasons: Map<string, string>;
    delegationStatuses: Map<string, boolean>;
    delegationHistories: Map<string, DelegationHistory[]>;
    delegationLocks: Map<string, number>;
    effectivePowers: Map<string, number>;
  } = {
    admin: "ST1ADMIN",
    maxDepth: 10,
    minLockPeriod: 144,
    maxHistory: 5,
    authorityContract: null,
    delegations: new Map(),
    delegationTimestamps: new Map(),
    delegationExpirations: new Map(),
    delegationReasons: new Map(),
    delegationStatuses: new Map(),
    delegationHistories: new Map(),
    delegationLocks: new Map(),
    effectivePowers: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      admin: "ST1ADMIN",
      maxDepth: 10,
      minLockPeriod: 144,
      maxHistory: 5,
      authorityContract: null,
      delegations: new Map(),
      delegationTimestamps: new Map(),
      delegationExpirations: new Map(),
      delegationReasons: new Map(),
      delegationStatuses: new Map(),
      delegationHistories: new Map(),
      delegationLocks: new Map(),
      effectivePowers: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
  }

  validatePrincipal(principalToCheck: string): Result<boolean> {
    if (principalToCheck === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    return { ok: true, value: true };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: false };
    const validation = this.validatePrincipal(contractPrincipal);
    if (!validation.ok) return { ok: false, value: false };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxDepth(newDepth: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: false };
    if (newDepth <= 0) return { ok: false, value: false };
    this.state.maxDepth = newDepth;
    return { ok: true, value: true };
  }

  setMinLockPeriod(newPeriod: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: false };
    if (newPeriod <= 0) return { ok: false, value: false };
    this.state.minLockPeriod = newPeriod;
    return { ok: true, value: true };
  }

  setMaxHistory(newMax: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: false };
    if (newMax <= 0) return { ok: false, value: false };
    this.state.maxHistory = newMax;
    return { ok: true, value: true };
  }

  delegateVote(delegatee: string, expiration: number, reason: string, lockPeriod: number): Result<boolean> {
    const validation = this.validatePrincipal(delegatee);
    if (!validation.ok) return { ok: false, value: false };
    if (delegatee === this.caller) return { ok: false, value: false };
    if (expiration <= this.blockHeight) return { ok: false, value: false };
    if (reason.length > 256) return { ok: false, value: false };
    if (lockPeriod < this.state.minLockPeriod) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (this.state.delegations.has(this.caller)) return { ok: false, value: false };
    this.state.delegations.set(this.caller, delegatee);
    this.state.delegationTimestamps.set(this.caller, this.blockHeight);
    this.state.delegationExpirations.set(this.caller, expiration);
    this.state.delegationReasons.set(this.caller, reason);
    this.state.delegationStatuses.set(this.caller, true);
    this.state.delegationLocks.set(this.caller, this.blockHeight + lockPeriod);
    this.state.delegationHistories.set(this.caller, [{ delegate: delegatee, timestamp: this.blockHeight }]);
    return { ok: true, value: true };
  }

  revokeDelegation(): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (!this.state.delegations.has(this.caller)) return { ok: false, value: false };
    const lock = this.state.delegationLocks.get(this.caller) || 0;
    if (this.blockHeight < lock) return { ok: false, value: false };
    this.state.delegations.delete(this.caller);
    this.state.delegationTimestamps.delete(this.caller);
    this.state.delegationExpirations.delete(this.caller);
    this.state.delegationReasons.delete(this.caller);
    this.state.delegationStatuses.delete(this.caller);
    this.state.delegationLocks.delete(this.caller);
    return { ok: true, value: true };
  }

  updateDelegationReason(newReason: string): Result<boolean> {
    if (newReason.length > 256) return { ok: false, value: false };
    if (!this.state.delegations.has(this.caller)) return { ok: false, value: false };
    const expiration = this.state.delegationExpirations.get(this.caller) || 0;
    if (expiration <= this.blockHeight) return { ok: false, value: false };
    this.state.delegationReasons.set(this.caller, newReason);
    return { ok: true, value: true };
  }

  extendDelegationExpiration(newExpiration: number): Result<boolean> {
    if (newExpiration <= this.blockHeight) return { ok: false, value: false };
    if (!this.state.delegations.has(this.caller)) return { ok: false, value: false };
    const expiration = this.state.delegationExpirations.get(this.caller) || 0;
    if (expiration <= this.blockHeight) return { ok: false, value: false };
    this.state.delegationExpirations.set(this.caller, newExpiration);
    return { ok: true, value: true };
  }

  getDelegateChain(voter: string): Result<string[]> {
    let chain: string[] = [voter];
    let current = voter;
    let visited: string[] = [voter];
    for (let i = 0; i < this.state.maxDepth; i++) {
      const delegate = this.state.delegations.get(current);
      if (!delegate) break;
      if (visited.includes(delegate)) return { ok: false, value: [] };
      chain.push(delegate);
      visited.push(current);
      current = delegate;
    }
    if (chain.length > this.state.maxDepth) return { ok: false, value: [] };
    return { ok: true, value: chain };
  }

  getEffectiveDelegate(voter: string): Result<string> {
    const expiration = this.state.delegationExpirations.get(voter) || 0;
    if (expiration <= this.blockHeight) return { ok: false, value: "" };
    if (!this.state.delegations.has(voter)) return { ok: false, value: "" };
    const chainResult = this.getDelegateChain(voter);
    if (!chainResult.ok) return { ok: false, value: "" };
    return { ok: true, value: chainResult.value[chainResult.value.length - 1] };
  }

  toggleDelegationStatus(): Result<boolean> {
    if (!this.state.delegations.has(this.caller)) return { ok: false, value: false };
    const expiration = this.state.delegationExpirations.get(this.caller) || 0;
    if (expiration <= this.blockHeight) return { ok: false, value: false };
    const current = this.state.delegationStatuses.get(this.caller) || false;
    this.state.delegationStatuses.set(this.caller, !current);
    return { ok: true, value: !current };
  }

  addToHistory(delegatee: string): Result<boolean> {
    const validation = this.validatePrincipal(delegatee);
    if (!validation.ok) return { ok: false, value: false };
    if (!this.state.delegations.has(this.caller)) return { ok: false, value: false };
    const expiration = this.state.delegationExpirations.get(this.caller) || 0;
    if (expiration <= this.blockHeight) return { ok: false, value: false };
    let history = this.state.delegationHistories.get(this.caller) || [];
    if (history.length >= this.state.maxHistory) return { ok: false, value: false };
    history.push({ delegate: delegatee, timestamp: this.blockHeight });
    this.state.delegationHistories.set(this.caller, history);
    return { ok: true, value: true };
  }

  getAdmin(): Result<string> {
    return { ok: true, value: this.state.admin };
  }

  getMaxDepth(): Result<number> {
    return { ok: true, value: this.state.maxDepth };
  }

  getMinLockPeriod(): Result<number> {
    return { ok: true, value: this.state.minLockPeriod };
  }

  getMaxHistory(): Result<number> {
    return { ok: true, value: this.state.maxHistory };
  }

  getAuthorityContract(): Result<string | null> {
    return { ok: true, value: this.state.authorityContract };
  }
}

describe("DelegationManager", () => {
  let contract: DelegationManagerMock;

  beforeEach(() => {
    contract = new DelegationManagerMock();
    contract.reset();
  });

  it("sets authority contract successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setAuthorityContract("ST2AUTH");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2AUTH");
  });

  it("rejects set authority by non-admin", () => {
    contract.caller = "ST1TEST";
    const result = contract.setAuthorityContract("ST2AUTH");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets max depth successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setMaxDepth(15);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxDepth).toBe(15);
  });

  it("rejects invalid max depth", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setMaxDepth(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("delegates vote successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    const result = contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.delegations.get("ST1TEST")).toBe("ST2DELEGATE");
    expect(contract.state.delegationExpirations.get("ST1TEST")).toBe(1000);
    expect(contract.state.delegationReasons.get("ST1TEST")).toBe("Trust expertise");
    expect(contract.state.delegationLocks.get("ST1TEST")).toBe(200);
  });

  it("rejects delegation without authority", () => {
    const result = contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects self delegation", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    const result = contract.delegateVote("ST1TEST", 1000, "Trust expertise", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects delegation with invalid expiration", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    const result = contract.delegateVote("ST2DELEGATE", 0, "Trust expertise", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects delegation with short lock period", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    const result = contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("revokes delegation successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    contract.blockHeight = 300;
    const result = contract.revokeDelegation();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.delegations.has("ST1TEST")).toBe(false);
  });

  it("rejects revocation when locked", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    contract.blockHeight = 100;
    const result = contract.revokeDelegation();
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates reason successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Old reason", 200);
    const result = contract.updateDelegationReason("New reason");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.delegationReasons.get("ST1TEST")).toBe("New reason");
  });

  it("rejects update reason for expired", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 100, "Old reason", 200);
    contract.blockHeight = 200;
    const result = contract.updateDelegationReason("New reason");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("extends expiration successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    const result = contract.extendDelegationExpiration(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.delegationExpirations.get("ST1TEST")).toBe(2000);
  });

  it("gets delegate chain successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    contract.caller = "ST2DELEGATE";
    contract.delegateVote("ST3FINAL", 1000, "Further trust", 200);
    contract.caller = "ST1TEST";
    const result = contract.getDelegateChain("ST1TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toEqual(["ST1TEST", "ST2DELEGATE", "ST3FINAL"]);
  });

  it("detects cycle in chain", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust", 200);
    contract.caller = "ST2DELEGATE";
    contract.delegateVote("ST1TEST", 1000, "Cycle", 200);
    contract.caller = "ST1TEST";
    const result = contract.getDelegateChain("ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toEqual([]);
  });

  it("gets effective delegate successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    contract.caller = "ST2DELEGATE";
    contract.delegateVote("ST3FINAL", 1000, "Further trust", 200);
    contract.caller = "ST1TEST";
    const result = contract.getEffectiveDelegate("ST1TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("ST3FINAL");
  });

  it("toggles status successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    const result = contract.toggleDelegationStatus();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(false);
    expect(contract.state.delegationStatuses.get("ST1TEST")).toBe(false);
  });

  it("adds to history successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    const result = contract.addToHistory("ST3NEW");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const history = contract.state.delegationHistories.get("ST1TEST") || [];
    expect(history.length).toBe(2);
    expect(history[1].delegate).toBe("ST3NEW");
  });

  it("rejects add to history when max exceeded", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST1TEST";
    contract.delegateVote("ST2DELEGATE", 1000, "Trust expertise", 200);
    for (let i = 0; i < 5; i++) {
      contract.addToHistory(`ST${i + 3}`);
    }
    const result = contract.addToHistory("ST8");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("gets admin", () => {
    const result = contract.getAdmin();
    expect(result.ok).toBe(true);
    expect(result.value).toBe("ST1ADMIN");
  });

  it("gets max depth", () => {
    const result = contract.getMaxDepth();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(10);
  });

  it("gets min lock period", () => {
    const result = contract.getMinLockPeriod();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(144);
  });

  it("gets max history", () => {
    const result = contract.getMaxHistory();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(5);
  });

  it("gets authority contract", () => {
    contract.caller = "ST1ADMIN";
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.getAuthorityContract();
    expect(result.ok).toBe(true);
    expect(result.value).toBe("ST2AUTH");
  });
});