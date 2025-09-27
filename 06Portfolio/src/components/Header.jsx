import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Drawer,
  Avatar,
  useMediaQuery,
  useTheme,
  Typography,
  Box,
  Chip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Code as CodeIcon,
  Work as WorkIcon,
  Email as EmailIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const menuItems = [
    { name: "Home", id: "home", icon: <HomeIcon sx={{ fontSize: 18 }} /> },
    { name: "About", id: "about", icon: <PersonIcon sx={{ fontSize: 18 }} /> },
    { name: "Skills", id: "skills", icon: <CodeIcon sx={{ fontSize: 18 }} /> },
    { name: "Projects", id: "projects", icon: <WorkIcon sx={{ fontSize: 18 }} /> },
    { name: "Contact", id: "contact", icon: <EmailIcon sx={{ fontSize: 18 }} /> },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = menuItems.map((item) => item.id);
      const currentSection = sections.find((section) => {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          return rect.top <= 100 && rect.bottom >= 100;
        }
        return false;
      });

      if (currentSection) setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const scrollToSection = (section) => {
    const element = document.getElementById(section);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
    setMobileOpen(false);
  };

  const drawerContent = (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        width: "320px",
        height: "100%",
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)",
        padding: "24px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Background Pattern */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)",
        pointerEvents: "none"
      }} />
      
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "32px", 
          paddingBottom: "20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Avatar 
              sx={{ 
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                width: 40,
                height: 40,
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              JD
            </Avatar>
            <div>
              <Typography variant="h6" sx={{ color: "white", fontWeight: 600, fontSize: "16px" }}>
                John Doe
              </Typography>
              <Typography variant="caption" sx={{ color: "#a78bfa", fontSize: "12px" }}>
                Full Stack Developer
              </Typography>
            </div>
          </div>
          <IconButton 
            onClick={handleDrawerToggle} 
            sx={{ 
              color: "white",
              "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.1)" }
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {menuItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Button
                onClick={() => scrollToSection(item.id)}
                startIcon={item.icon}
                endIcon={activeSection === item.id ? <ArrowForwardIcon sx={{ fontSize: 16 }} /> : null}
                sx={{
                  textTransform: "none",
                  justifyContent: "flex-start",
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: activeSection === item.id ? "white" : "#a1a1aa",
                  backgroundColor: activeSection === item.id 
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                    : "transparent",
                  "&:hover": {
                    backgroundColor: activeSection === item.id 
                      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                      : "rgba(255, 255, 255, 0.05)",
                    color: "white",
                    transform: "translateX(4px)"
                  },
                  transition: "all 0.2s ease-in-out"
                }}
              >
                {item.name}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
      >
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            backgroundColor: scrolled 
              ? "rgba(15, 15, 35, 0.95)" 
              : "rgba(15, 15, 35, 0.1)",
            backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "blur(0px)",
            borderBottom: scrolled 
              ? "1px solid rgba(255, 255, 255, 0.1)" 
              : "1px solid transparent",
            boxShadow: scrolled 
              ? "0 8px 32px rgba(0, 0, 0, 0.3)" 
              : "none"
          }}
        >
          <Toolbar
            sx={{
              maxWidth: "1400px",
              mx: "auto",
              width: "100%",
              px: { xs: 2, md: 4 },
              py: 2,
              minHeight: "80px !important",
              justifyContent: "space-between",
            }}
          >
            {/* Logo Section */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                cursor: "pointer",
                padding: "8px",
                borderRadius: "12px",
                transition: "all 0.2s ease"
              }}
              onClick={() => scrollToSection("home")}
            >
              <Avatar 
                sx={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  width: 44,
                  height: 44,
                  fontSize: "16px",
                  fontWeight: "bold",
                  boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)"
                }}
              >
                JD
              </Avatar>
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: "white", 
                    fontWeight: 700, 
                    fontSize: "18px",
                    lineHeight: 1.2
                  }}
                >
                  John Doe
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: "#a78bfa", 
                    fontSize: "12px",
                    fontWeight: 500
                  }}
                >
                  Full Stack Developer
                </Typography>
              </Box>
            </motion.div>

            {/* Desktop Navigation */}
            {!isMobile && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {menuItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Button
                      onClick={() => scrollToSection(item.id)}
                      startIcon={item.icon}
                      endIcon={activeSection === item.id ? 
                        <ArrowForwardIcon sx={{ fontSize: 14, ml: 0.5 }} /> : null
                      }
                      sx={{
                        textTransform: "none",
                        borderRadius: "25px",
                        px: 3,
                        py: 1.5,
                        fontSize: "14px",
                        fontWeight: 500,
                        color: activeSection === item.id ? "white" : "#a1a1aa",
                        backgroundColor: activeSection === item.id 
                          ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                          : "transparent",
                        backgroundImage: activeSection === item.id 
                          ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                          : "none",
                        boxShadow: activeSection === item.id 
                          ? "0 4px 20px rgba(102, 126, 234, 0.3)" 
                          : "none",
                        "&:hover": {
                          backgroundColor: activeSection === item.id 
                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                            : "rgba(255, 255, 255, 0.05)",
                          color: "white",
                          transform: "translateY(-2px)",
                          boxShadow: activeSection === item.id 
                            ? "0 6px 25px rgba(102, 126, 234, 0.4)" 
                            : "0 4px 15px rgba(0, 0, 0, 0.2)"
                        },
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                      }}
                    >
                      {item.name}
                    </Button>
                  </motion.div>
                ))}
              </Box>
            )}

            {/* Mobile Menu Button */}
            {isMobile && (
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <IconButton 
                  onClick={handleDrawerToggle} 
                  sx={{ 
                    color: "white",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    "&:hover": { 
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      transform: "rotate(90deg)"
                    },
                    transition: "all 0.3s ease"
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </motion.div>
            )}
          </Toolbar>
        </AppBar>
      </motion.div>

      {/* Spacer */}
      <div style={{ height: "80px" }} />

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <Drawer
            variant="temporary"
            anchor="right"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            PaperProps={{ 
              style: { 
                background: "transparent", 
                boxShadow: "none",
                width: "320px"
              } 
            }}
          >
            {drawerContent}
          </Drawer>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
