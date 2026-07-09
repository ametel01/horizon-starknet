use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{Call, IRouterDispatcher, IRouterDispatcherTrait};
use horizon::interfaces::i_sy::ISYDispatcherTrait;
use horizon::interfaces::i_yt::IYTDispatcherTrait;
use horizon::libraries::math::WAD;
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};
use crate::utils::{DEFAULT_DEADLINE, admin, mint_and_deposit_sy, setup_full, user1};

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

fn mint_py_from_sy_call(
    router: ContractAddress,
    yt: ContractAddress,
    receiver: ContractAddress,
    amount_sy_in: u256,
    min_py_out: u256,
) -> Call {
    let mut calldata = array![];
    calldata.append(yt.into());
    calldata.append(receiver.into());
    calldata.append(amount_sy_in.low.into());
    calldata.append(amount_sy_in.high.into());
    calldata.append(min_py_out.low.into());
    calldata.append(min_py_out.high.into());
    calldata.append(DEFAULT_DEADLINE.into());

    Call { to: router, selector: selector!("mint_py_from_sy"), calldata: calldata.span() }
}

#[test]
fn test_multicall_executes_guarded_router_self_call() {
    let (_, yield_token, sy, yt) = setup_full();
    let router = deploy_router();
    let user = user1();
    let amount = 100 * WAD;
    mint_and_deposit_sy(yield_token, sy, user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    let call = mint_py_from_sy_call(router.contract_address, yt.contract_address, user, amount, 0);

    start_cheat_caller_address(router.contract_address, user);
    let results = router.multicall(array![call].span());
    stop_cheat_caller_address(router.contract_address);

    assert(results.len() == 1, 'Expected one multicall result');
    assert(pt.balance_of(user) > 0, 'Should receive PT');
    assert(yt.balance_of(user) > 0, 'Should receive YT');
}

#[test]
#[should_panic(expected: 'HZN: multicall invalid target')]
fn test_multicall_rejects_non_router_target() {
    let (_, _, sy, _) = setup_full();
    let router = deploy_router();
    let user = user1();
    let call = Call {
        to: sy.contract_address,
        selector: selector!("balance_of"),
        calldata: array![user.into()].span(),
    };

    start_cheat_caller_address(router.contract_address, user);
    router.multicall(array![call].span());
    stop_cheat_caller_address(router.contract_address);
}
