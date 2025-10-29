"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui";
import WalletSidebar from "./WalletSidebar";

const WalletButton: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <>
      <Button
        onClick={() => setSidebarOpen(true)}
        className="rounded-full !text-white !h-10 border !border-[#C7F284] font-light !px-4 !transition-colors bg-[#0E1424] hover:bg-[#C7F284] hover:!text-black"
      >
        {!connected ? (
          <div className="flex items-center gap-2">
            Connect Wallet
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {publicKey ? shortenAddress(publicKey.toString()) : "Connected"}
          </div>
        )}
      </Button>
      <WalletSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </>
  );
};

export default WalletButton;
