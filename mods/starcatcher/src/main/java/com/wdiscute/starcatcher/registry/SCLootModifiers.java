package com.wdiscute.starcatcher.registry;

import net.fabricmc.fabric.api.loot.v3.LootTableEvents;
import net.minecraft.world.level.storage.loot.BuiltInLootTables;
import net.minecraft.world.level.storage.loot.LootPool;
import net.minecraft.world.level.storage.loot.entries.LootItem;
import net.minecraft.world.level.storage.loot.predicates.LootItemRandomChanceCondition;

public interface SCLootModifiers
{
    static void register()
    {
        LootTableEvents.MODIFY.register((key, tableBuilder, source, registries) ->
        {
            if (!key.equals(BuiltInLootTables.SHIPWRECK_MAP)) return;

            LootPool.Builder pool = LootPool.lootPool().when(LootItemRandomChanceCondition.randomChance(0.5f));
            SCBlocks.HATS.getEntries().forEach(o -> pool.add(LootItem.lootTableItem(o.get().asItem())));
            tableBuilder.withPool(pool);
        });
    }
}
