"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet } from "lucide-react";
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
        className="!rounded-lg !text-white !h-10 !px-4 !font-medium !transition-colors bg-blue-600 hover:bg-blue-700"
      >
        {!connected ? (
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {publicKey ? shortenAddress(publicKey.toString()) : "Connected"}
          </div>
        )}
      </Button>
      <WalletSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </>
  );
};

export default WalletButton;
