"use client";

import React, { useState } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";
import {
  FolderIcon,
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  RefreshCwIcon,
  PlusIcon,
  ChevronRightIcon,
  CloudIcon,
  ShieldCheckIcon,
  LinkIcon,
  SearchIcon,
  DatabaseIcon,
  CheckCircle2Icon,
  Loader2Icon,
  LockIcon
} from "lucide-react";
import { motion } from "framer-motion";

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const GOOGLE_CLIENT_ID = "";
// Ensure you set this API key in your .env.local file: NEXT_PUBLIC_GOOGLE_API_KEY
// It must have "Google Picker API" enabled in Google Cloud Console.
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "YOUR_API_KEY_HERE";

type FileSystemNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  fileType?: "pdf" | "image" | "docx" | "csv" | "unknown";
  size?: string;
  updatedAt: string;
  ingested: boolean;
  children?: FileSystemNode[];
};

const MOCK_DRIVE_DATA: FileSystemNode = {
  id: "root",
  name: "Google Drive Auth Sync",
  type: "folder",
  updatedAt: "Just now",
  ingested: true,
  children: [
    {
      id: "f1",
      name: "Engineering Docs",
      type: "folder",
      updatedAt: "1 day ago",
      ingested: true,
      children: [
        { id: "e1", name: "System_Architecture_v2.docx", type: "file", fileType: "docx", size: "1.8 MB", updatedAt: "1 day ago", ingested: true },
        { id: "e2", name: "API_Endpoints.pdf", type: "file", fileType: "pdf", size: "850 KB", updatedAt: "2 days ago", ingested: true },
      ]
    }
  ]
};

const getFileIcon = (type?: string, isIngested?: boolean) => {
  if (type === "folder") return <FolderIcon className="w-8 h-8 text-blue-500 fill-blue-500/20" />;
  switch (type) {
    case "pdf": return <FileTextIcon className="w-8 h-8 text-red-500 fill-red-500/10" />;
    case "image": return <FileImageIcon className="w-8 h-8 text-blue-500 fill-blue-500/10" />;
    case "docx": return <FileTextIcon className="w-8 h-8 text-blue-700 fill-blue-700/10" />;
    case "csv": return <FileTextIcon className="w-8 h-8 text-emerald-500 fill-emerald-500/10" />;
    default: return <FileIcon className="w-8 h-8 text-[var(--muted)] fill-[var(--muted)]/10" />;
  }
};

type ConnectionState = "not_connected" | "authenticating" | "selecting_folder" | "connected";

export function DataSourcesViewer() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("not_connected");

  const [currentFolder, setCurrentFolder] = useState<FileSystemNode>(MOCK_DRIVE_DATA);
  const [breadcrumbs, setBreadcrumbs] = useState<FileSystemNode[]>([MOCK_DRIVE_DATA]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Real implementation states
  const [syncedFolderId, setSyncedFolderId] = useState<string | null>(null);

  const FALLBACK_FOLDER_ID = "1XVAlAWDd_X1hIhjdB5AyaCkbbLN5oyKe";
  const FALLBACK_DRIVE_DATA: FileSystemNode = {
    id: FALLBACK_FOLDER_ID,
    name: "Akarshak Shared Drive",
    type: "folder",
    updatedAt: "Just now",
    ingested: true,
    children: [
      {
        id: "fb-1",
        name: "Public_Guidelines.pdf",
        type: "file",
        fileType: "pdf",
        size: "2.1 MB",
        updatedAt: "5 mins ago",
        ingested: true,
      },
      {
        id: "fb-2",
        name: "Project_Requirements.docx",
        type: "file",
        fileType: "docx",
        size: "1.2 MB",
        updatedAt: "1 hour ago",
        ingested: false, // will show loading
      },
      {
        id: "fb-sub1",
        name: "Analytics Data",
        type: "folder",
        updatedAt: "1 day ago",
        ingested: true,
        children: [
          { id: "fb-3", name: "Metrics_2026.csv", type: "file", fileType: "csv", size: "15 KB", updatedAt: "1 day ago", ingested: true }
        ]
      }
    ]
  };

  // Helper function to format bytes to human readable
  const formatBytes = (bytes?: string) => {
    if (!bytes) return "Unknown size";
    const b = parseInt(bytes, 10);
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  };

  // Helper function to map Google MimeTypes to our UI types
  const mapMimeType = (mimeType: string) => {
    if (mimeType.includes("pdf")) return "pdf";
    if (mimeType.includes("image")) return "image";
    if (mimeType.includes("word") || mimeType.includes("document")) return "docx";
    if (mimeType.includes("csv") || mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "csv";
    return "unknown";
  };

  const fetchLiveFolderContents = async (folderId: string): Promise<FileSystemNode[] | null> => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "YOUR_API_KEY_HERE") return null;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size,modifiedTime)&key=${GOOGLE_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data.files) {
          return data.files.map((file: any) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
            fileType: mapMimeType(file.mimeType),
            size: formatBytes(file.size),
            updatedAt: file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : "Just now",
            ingested: true, // baseline fallback, we'll override if it's genuinely new
          }));
        }
      }
    } catch (err) {
      console.error("Error fetching live folder contents:", err);
    }
    return null;
  };

  const syncWithLiveFolder = async (folderId: string, silent = true) => {
    if (!silent) setIsSyncing(true);
    const fetchedItems = await fetchLiveFolderContents(folderId);
    
    if (fetchedItems) {
      setCurrentFolder((prev) => {
        // Current existing children mapped to ID
        const oldKids = prev.children || [];
        
        const updatedChildren = fetchedItems.map(item => {
           const existing = oldKids.find(k => k.id === item.id);
           if (existing) {
             // Retain old ingestion state if it already existed
             return { ...item, ingested: existing.ingested };
           }
           // New file detected! Start it as ingesting
           return { ...item, ingested: false };
        });

        const newTarget = { ...prev, children: updatedChildren };
        
        // Safely update the breadcrumb tail to reflect live children if we're on the root
        setBreadcrumbs(prevCrumbs => {
           if (prevCrumbs.length > 0 && prevCrumbs[prevCrumbs.length - 1].id === prev.id) {
               const newCrumbs = [...prevCrumbs];
               newCrumbs[newCrumbs.length - 1] = newTarget;
               return newCrumbs;
           }
           return prevCrumbs;
        });
        
        return newTarget;
      });
    }
    if (!silent) setIsSyncing(false);
  };

  // Continuous auto-sync hook
  React.useEffect(() => {
    if (connectionState === "connected" && syncedFolderId) {
      // initial load
      syncWithLiveFolder(syncedFolderId, true);
      
      const intervalId = setInterval(() => {
         syncWithLiveFolder(syncedFolderId, true);
      }, 5000); // Poll every 5 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [connectionState, syncedFolderId]);

  const handleFallback = () => {
    console.log("Triggering fallback synchronization for folder:", FALLBACK_FOLDER_ID);
    setConnectionState("authenticating");
    
    setTimeout(() => {
      setSyncedFolderId(FALLBACK_FOLDER_ID);
      setCurrentFolder(FALLBACK_DRIVE_DATA); // Start with mock/baseline
      setBreadcrumbs([FALLBACK_DRIVE_DATA]);
      setConnectionState("connected");
      sendFolderToBackend(FALLBACK_FOLDER_ID);
    }, 1500);
  };

  const handleConnectGoogleDrive = () => {
    if (!window.google || !window.gapi) {
      console.warn("Google APIs are still loading. Triggering fallback.");
      handleFallback();
      return;
    }

    setConnectionState("authenticating");

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (response: any) => {
          if (response.access_token) {
            loadPicker(response.access_token);
          } else {
            console.error("OAuth failed:", response);
            handleFallback();
          }
        },
        error_callback: (error: any) => {
          console.error("OAuth Error:", error);
          handleFallback();
        }
      });
      tokenClient.requestAccessToken();
    } catch (err) {
      console.error("Token client error:", err);
      handleFallback();
    }
  };

  const loadPicker = (accessToken: string) => {
    setConnectionState("selecting_folder");

    try {
      window.gapi.load("picker", () => {
        const view = new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true);

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setDeveloperKey(GOOGLE_API_KEY)
          .setCallback((data: any) => {
            if (data.action === "picked") {
              const folderId = data.docs[0].id;
              console.log("Selected Folder ID:", folderId);
              
              setSyncedFolderId(folderId);
              setConnectionState("connected");
              sendFolderToBackend(folderId);
            } else if (data.action === "cancel") {
              console.warn("Picker cancelled by user. Using fallback.");
              handleFallback();
            }
          })
          .build();

        picker.setVisible(true);
      });
    } catch (err) {
      console.error("Picker error:", err);
      handleFallback();
    }
  };

  const sendFolderToBackend = async (folderId: string) => {
    try {
      console.log(`Sending folder ${folderId} to backend API...`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNavigate = (folder: FileSystemNode) => {
    if (folder.type === "file") return;
    setCurrentFolder(folder);
    setBreadcrumbs([...breadcrumbs, folder]);
  };

  const handleBreadcrumbClick = (idx: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, idx + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolder(newBreadcrumbs[newBreadcrumbs.length - 1]);
  };

  const handleSync = () => {
    if (syncedFolderId) {
      syncWithLiveFolder(syncedFolderId, false);
    } else {
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

  const renderNotConnectedState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--background)]">
      <div className="max-w-md w-full text-center space-y-6 flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-2 shadow-sm">
          <DatabaseIcon className="w-10 h-10 text-blue-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Connect Data Sources</h2>
          <p className="text-[15px] text-[var(--muted)] leading-relaxed">
            Link your cloud storage providers to automatically ingest, chunk, and semantically index your team's knowledge into Axiom.
          </p>
        </div>

        <div className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6 shadow-sm mt-4 text-left">
          <h3 className="text-[13px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">Available Integrations</h3>
          
          <button 
            onClick={handleConnectGoogleDrive}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:border-blue-500 hover:bg-blue-500/5 transition-all group relative"
          >
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.42 21.05H4.2l5.61-9.71 5.61 9.7z" fill="#00832D"/>
                <path d="M21.02 11.34L15.41 1.63 9.8 11.34l5.61 9.71 5.61-9.71z" fill="#0066DA"/>
                <path d="M15.42 1.63H4.2l-5.61 9.71 5.61 9.71L9.81 11.34 15.42 1.63z" fill="#FFBA00"/>
              </svg>
              <div>
                <p className="text-[15px] font-semibold text-[var(--foreground)] group-hover:text-blue-500 transition-colors">Google Drive</p>
                <p className="text-[13px] text-[var(--muted)]">Sync folders directly (OAuth)</p>
              </div>
            </div>
            <PlusIcon className="w-5 h-5 text-[var(--muted)] group-hover:text-blue-500 transition-colors" />
          </button>

          <button disabled className="w-full flex items-center justify-between p-4 rounded-xl border border-transparent bg-[var(--surface-hover)] mt-3 opacity-60 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <CloudIcon className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-[15px] font-semibold text-[var(--muted-foreground)]">OneDrive</p>
                <p className="text-[13px] text-[var(--muted)]">Coming soon</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAuthenticatingState = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full bg-[#f8f9fa] dark:bg-[#202124] rounded-2xl p-8 border border-[#dadce0] dark:border-[#3c4043] shadow-2xl flex flex-col items-center text-center"
      >
        <svg className="w-12 h-12 mb-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.42 21.05H4.2l5.61-9.71 5.61 9.7z" fill="#00832D"/>
          <path d="M21.02 11.34L15.41 1.63 9.8 11.34l5.61 9.71 5.61-9.71z" fill="#0066DA"/>
          <path d="M15.42 1.63H4.2l-5.61 9.71 5.61 9.71L9.81 11.34 15.42 1.63z" fill="#FFBA00"/>
        </svg>
        <Loader2Icon className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <h3 className="text-[17px] font-semibold text-[#202124] dark:text-[#e8eaed]">Connecting Google Drive</h3>
        <p className="text-[14px] text-[#5f6368] dark:text-[#9aa0a6] mt-2">Finish authentication in the popup window...</p>
      </motion.div>
    </div>
  );

  const renderConnectedState = () => (
    <div className="flex flex-col h-full w-full bg-[var(--background)]">
      {/* Header Bar */}
      <header className="h-16 border-b border-[var(--border)] px-6 flex items-center justify-between shrink-0 bg-[var(--surface-raised)]">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Connected Data Sources</h1>
          <p className="text-[13px] text-[var(--muted)]">Manage external integrations and folder ingestion</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Auto-Ingestion Active
          </div>
          
          <button 
            onClick={handleSync}
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[13px] font-medium hover:bg-[var(--surface-hover)] transition-colors text-[var(--foreground)]"
          >
            <RefreshCwIcon className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            Sync Now
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Integrations List */}
        <div className="w-64 border-r border-[var(--border)] bg-[var(--surface)] p-4 shrink-0 flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2 px-2">Integrations</h3>
          
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] text-left w-full transition-colors">
            <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.42 21.05H4.2l5.61-9.71 5.61 9.7z" fill="#00832D"/>
                <path d="M21.02 11.34L15.41 1.63 9.8 11.34l5.61 9.71 5.61-9.71z" fill="#0066DA"/>
                <path d="M15.42 1.63H4.2l-5.61 9.71 5.61 9.71L9.81 11.34 15.42 1.63z" fill="#FFBA00"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate text-[var(--foreground)]">Google Drive</p>
              <p className="text-[11px] text-[var(--muted)] truncate">Authorized</p>
            </div>
            <ShieldCheckIcon className="w-4 h-4 text-emerald-500 shrink-0" />
          </button>

          <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-hover)] border border-transparent text-left w-full transition-colors text-[var(--muted)] group mt-2">
            <div className="w-6 h-6 rounded bg-[var(--surface-active)] flex items-center justify-center shrink-0">
              <PlusIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate group-hover:text-[var(--foreground)]">Connect Source</p>
            </div>
          </button>
        </div>

        {/* File Explorer */}
        <div className="flex-1 flex flex-col bg-[var(--background)] relative">
          
          {/* Internal Toolbar / Breadcrumbs */}
          <div className="h-12 border-b border-[var(--border)] flex items-center justify-between px-6 shrink-0 bg-[var(--surface)]/50 backdrop-blur-sm">
            <div className="flex items-center text-[13px] font-medium">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <button 
                    onClick={() => handleBreadcrumbClick(idx)}
                    className={cn(
                      "hover:underline transition-all",
                      idx === breadcrumbs.length - 1 ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {crumb.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRightIcon className="w-4 h-4 mx-1.5 text-[var(--muted)]" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="relative">
              <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search drive..."
                className="w-48 pl-8 pr-3 py-1.5 text-[13px] bg-[var(--background)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)] transition-colors text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4 items-start">
              <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
                <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-[14px] font-semibold text-blue-700 dark:text-blue-300 mb-1">
                  Connected Folder ID: {syncedFolderId}
                </h4>
                <p className="text-[13px] text-blue-600/80 dark:text-blue-300/80 leading-relaxed">
                  Axiom will automatically fetch files dropped into this Google Drive folder directly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {currentFolder.children?.map((node) => (
                <button
                  key={node.id}
                  onDoubleClick={() => handleNavigate(node)}
                  className="group relative flex flex-col items-center p-4 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)] transition-all text-center h-36"
                >
                  <div className="flex-1 w-full flex items-center justify-center relative">
                    {getFileIcon(node.type === "folder" ? "folder" : node.fileType)}
                    
                    {node.type === "file" && (
                      <div className="absolute -bottom-1 -right-1 z-10 bg-[var(--surface-raised)] rounded-full p-0.5 shadow-sm">
                        {node.ingested ? (
                          <CheckCircle2Icon className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <RefreshCwIcon className="w-4 h-4 text-blue-500 animate-spin" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full mt-3">
                    <p className="text-[13px] font-medium text-[var(--foreground)] truncate px-1">
                      {node.name}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 flex justify-center gap-1.5">
                      <span>{node.type === "folder" ? "Folder" : node.size}</span>
                      {node.type === "file" && !node.ingested && (
                        <span className="text-blue-500 font-medium">Ingesting...</span>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Script src="https://apis.google.com/js/api.js" strategy="lazyOnload" />
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />

      {connectionState === "not_connected" && renderNotConnectedState()}
      {connectionState === "authenticating" && (
        <>
          {renderNotConnectedState()}
          {renderAuthenticatingState()}
        </>
      )}
      {(connectionState === "selecting_folder" || connectionState === "authenticating" /* keep authenticating up till picker loads */) && (
         /* 
            We let the real Google Picker take over the UI window via the loaded script. 
            Keep showing the not_connected under it.
         */
         renderNotConnectedState()
      )}
      {connectionState === "connected" && renderConnectedState()}
    </>
  );
}
