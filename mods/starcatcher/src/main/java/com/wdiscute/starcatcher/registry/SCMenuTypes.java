package com.wdiscute.starcatcher.registry;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.blocks.tacklebox.TackleBoxMenu;
import com.wdiscute.starcatcher.tournament.StandMenu;
import net.fabricmc.fabric.api.screenhandler.v1.ExtendedScreenHandlerType;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.MenuType;

import java.util.function.Supplier;

public interface SCMenuTypes
{
    DeferredRegister<MenuType<?>> MENUS =
            DeferredRegister.create(BuiltInRegistries.MENU, Starcatcher.MOD_ID);

    Supplier<MenuType<StandMenu>> STAND_MENU =
            registerMenuType("stand_menu", StandMenu::new);

    Supplier<MenuType<TackleBoxMenu>> TACKLE_BOX =
            registerMenuType("tackle_box.png", TackleBoxMenu::new);

    private static <T extends AbstractContainerMenu>DeferredHolder<MenuType<?>, MenuType<T>> registerMenuType(String name,
                                                                                                              ExtendedScreenHandlerType.ExtendedFactory<T, BlockPos> factory) {
        return MENUS.register(name, () -> new ExtendedScreenHandlerType<>(factory, BlockPos.STREAM_CODEC));
    }

    static void register() {
        MENUS.register();
    }
}
