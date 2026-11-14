package com.wdiscute.starcatcher.lib.multiblock;

import com.wdiscute.starcatcher.Starcatcher;
import com.wdiscute.starcatcher.lib.multiblock.blockentities.SimpleMultiBlockEntity;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.block.entity.BlockEntityType;

public interface CommonRegistration {
    BlockEntityType<SimpleMultiBlockEntity> SIMPLE_MULTIBLOCK_ENTITY = Registry.register(
            BuiltInRegistries.BLOCK_ENTITY_TYPE,
            Starcatcher.rl("simple_multiblock_entity"),
            BlockEntityType.Builder.of(SimpleMultiBlockEntity::new).build(null)
    );

    static void register()
    {
    }
}
